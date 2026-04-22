import process from 'node:process';

import {
  clearTailscaleServeOwner,
  readTailscaleServeOwner,
  withTailscaleServeOwnerLock,
  writeTailscaleServeOwner,
} from '../my-code-x-tailscale-owner.mjs';
import { buildTailscaleServeUrl, readTailscaleServeConfig, readTailscaleStatus } from './tailscale-status.mjs';

function isProcessRunning(pid) {
  if (!pid) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function configureTailscaleServeUnchecked(port, runTailscaleCommand) {
  const initialStatus = await readTailscaleStatus(runTailscaleCommand);
  if (initialStatus.tailscaleIps.length === 0 && !initialStatus.dnsName) {
    throw new Error('Tailscale is running, but no reachable tailnet address was reported.');
  }

  try {
    await runTailscaleCommand(['serve', '--bg', '--https=443', `http://127.0.0.1:${port}`], { stdio: 'inherit' });
  } catch (error) {
    throw new Error(
      `Failed to configure Tailscale Serve HTTPS for My-Code-X on port ${port}.\n${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const currentStatus = await readTailscaleStatus(runTailscaleCommand);
  const url = buildTailscaleServeUrl(currentStatus.dnsName);
  if (!url) {
    throw new Error('Tailscale Serve is enabled, but no tailnet DNS name was reported. Enable MagicDNS/HTTPS and retry.');
  }

  return {
    ...currentStatus,
    url,
  };
}

export async function configureTailscaleServe(
  port,
  runTailscaleCommand,
  {
    ownership = null,
    userDir = process.env.MY_CODE_X_USER_DIR || '',
    isProcessRunningImpl = isProcessRunning,
  } = {},
) {
  if (!ownership?.ownerId) {
    return await configureTailscaleServeUnchecked(port, runTailscaleCommand);
  }

  return await withTailscaleServeOwnerLock(
    async () => {
      const currentOwner = await readTailscaleServeOwner({ userDir });
      if (
        currentOwner?.ownerId &&
        currentOwner.ownerId !== ownership.ownerId &&
        currentOwner.ownerPid &&
        isProcessRunningImpl(currentOwner.ownerPid)
      ) {
        throw new Error(
          `Tailscale Serve is already owned by another My-Code-X runtime at ${currentOwner.runtimeDir || 'unknown runtime'}.`,
        );
      }

      const result = await configureTailscaleServeUnchecked(port, runTailscaleCommand);
      const timestamp = new Date().toISOString();
      const ownerRecord = {
        ownerId: ownership.ownerId,
        runtimeDir: ownership.runtimeDir || '',
        port,
        url: result.url,
        claimedAt: currentOwner?.ownerId === ownership.ownerId ? currentOwner.claimedAt || timestamp : timestamp,
        updatedAt: timestamp,
        ownerPid: Number.isInteger(ownership.ownerPid) ? ownership.ownerPid : 0,
        pidRole: ownership.pidRole || '',
      };

      await writeTailscaleServeOwner(ownerRecord, { userDir });
      return {
        ...result,
        owner: ownerRecord,
      };
    },
    { userDir, isProcessRunningImpl },
  );
}

export async function refreshTailscaleServeOwner(
  ownership,
  {
    userDir = process.env.MY_CODE_X_USER_DIR || '',
    isProcessRunningImpl = isProcessRunning,
  } = {},
) {
  if (!ownership?.ownerId) {
    return null;
  }

  return await withTailscaleServeOwnerLock(
    async () => {
      const currentOwner = await readTailscaleServeOwner({ userDir });
      if (!currentOwner?.ownerId || currentOwner.ownerId !== ownership.ownerId) {
        return null;
      }

      const updatedOwner = {
        ...currentOwner,
        runtimeDir: ownership.runtimeDir || currentOwner.runtimeDir || '',
        url: ownership.url || currentOwner.url || '',
        port: Number.isInteger(ownership.port) ? ownership.port : currentOwner.port || 0,
        ownerPid: Number.isInteger(ownership.ownerPid) ? ownership.ownerPid : currentOwner.ownerPid || 0,
        pidRole: ownership.pidRole || currentOwner.pidRole || '',
        updatedAt: new Date().toISOString(),
      };

      await writeTailscaleServeOwner(updatedOwner, { userDir });
      return updatedOwner;
    },
    { userDir, isProcessRunningImpl },
  );
}

export async function disableTailscaleServe(runTailscaleCommand) {
  try {
    await runTailscaleCommand(['serve', '--https=443', 'off'], { captureOutput: true });
  } catch (error) {
    throw new Error(`Failed to disable Tailscale Serve HTTPS.\n${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function disableTailscaleServeIfOwned(
  runTailscaleCommand,
  {
    ownerId = '',
    userDir = process.env.MY_CODE_X_USER_DIR || '',
    isProcessRunningImpl = isProcessRunning,
  } = {},
) {
  const normalizedOwnerId = String(ownerId || '').trim();
  if (!normalizedOwnerId) {
    return { disabled: false, reason: 'missing_owner_id' };
  }

  return await withTailscaleServeOwnerLock(
    async () => {
      const currentOwner = await readTailscaleServeOwner({ userDir });
      if (!currentOwner?.ownerId) {
        return { disabled: false, reason: 'missing_owner_record' };
      }

      if (currentOwner.ownerId !== normalizedOwnerId) {
        return {
          disabled: false,
          reason: 'owner_mismatch',
          owner: currentOwner,
        };
      }

      await disableTailscaleServe(runTailscaleCommand);
      await clearTailscaleServeOwner({ userDir });
      return {
        disabled: true,
        owner: currentOwner,
      };
    },
    { userDir, isProcessRunningImpl },
  );
}

export async function probeTailscaleServe(
  runTailscaleCommand,
  {
    ownership = null,
    userDir = process.env.MY_CODE_X_USER_DIR || '',
    isProcessRunningImpl = isProcessRunning,
  } = {},
) {
  let serveConfig;
  try {
    serveConfig = await readTailscaleServeConfig(runTailscaleCommand);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  if (!serveConfig.configured) {
    return {
      ok: false,
      error: 'tailscale serve config missing',
    };
  }

  if (!ownership?.ownerId) {
    return { ok: true };
  }

  const currentOwner = await readTailscaleServeOwner({ userDir });
  if (!currentOwner?.ownerId) {
    return {
      ok: false,
      error: 'tailscale serve owner record missing',
    };
  }

  if (currentOwner.ownerId !== ownership.ownerId) {
    return {
      ok: false,
      error: `tailscale serve is owned by another runtime at ${currentOwner.runtimeDir || 'unknown runtime'}`,
    };
  }

  if (currentOwner.ownerPid && !isProcessRunningImpl(currentOwner.ownerPid)) {
    return {
      ok: false,
      error: 'tailscale serve owner process is not running',
    };
  }

  if (ownership.expectedUrl && currentOwner.url && ownership.expectedUrl !== currentOwner.url) {
    return {
      ok: false,
      error: 'tailscale serve owner URL does not match current state',
    };
  }

  return {
    ok: true,
    owner: currentOwner,
    serveConfig,
  };
}
