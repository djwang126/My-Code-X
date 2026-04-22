import fsp from 'node:fs/promises';
import process from 'node:process';
import { randomUUID } from 'node:crypto';

import {
  DEFAULT_BACKEND_STARTUP_TIMEOUT_MS,
  DEFAULT_BACKEND_WATCHDOG_TIMEOUT_MS,
  parseNumber,
} from '../my-code-x-supervisor-config.mjs';
import { reflectLiveBackendStatus } from '../my-code-x-supervisor-health.mjs';
import { disableTailscaleServeIfOwned, probeTailscaleServe } from '../tailscale-serve.mjs';
import { waitForProcessExit, stopProcessByPid } from '../my-code-x-managed-process.mjs';
import { acquireSupervisorStartLock } from './supervisor-start-lock.mjs';
import {
  cleanupStaleState,
  formatStateText,
  isProcessRunning,
  readJsonIfExists,
  requestControlAction,
  runTailscaleCommand,
  sanitizeState,
  startDetachedSelf,
  waitForStableState,
} from './supervisor-state-files.mjs';
import { ensureTailscaleInstalled } from '../tailscale/tailscale-bootstrap.mjs';

export async function handleStart({ parsed, paths, supervisorScriptPath }) {
  await fsp.mkdir(paths.runtimeDir, { recursive: true });
  const startLockTimeoutMs =
    parseNumber(process.env.MY_CODE_X_START_LOCK_TIMEOUT_MS, DEFAULT_BACKEND_STARTUP_TIMEOUT_MS) + 15_000;
  const startLock = await acquireSupervisorStartLock(paths.startLock, { timeoutMs: startLockTimeoutMs });
  try {
    const existingState = await cleanupStaleState(paths);
    if (existingState?.supervisor?.pid && isProcessRunning(existingState.supervisor.pid)) {
      const payload = sanitizeState(existingState);
      process.stdout.write(parsed.json ? `${JSON.stringify(payload)}\n` : formatStateText(payload));
      return;
    }

    const exposeMode = parsed.expose || String(process.env.MY_CODE_X_EXPOSE_MODE || 'lan').trim() || 'lan';
    const args = parsed.expose ? [`--expose=${parsed.expose}`] : [];

    let detachedEnv = process.env;
    let tailscaleManaged = false;
    if (exposeMode === 'tailscale' && !String(process.env.MY_CODE_X_TAILSCALE_URL || '').trim()) {
      await ensureTailscaleInstalled({ runTailscaleCommand });
      const port = parseNumber(process.env.PORT, 4310);
      const tailscaleOwnerId = randomUUID();
      const { configureTailscaleServe } = await import('../tailscale-serve.mjs');
      const tailscaleInfo = await configureTailscaleServe(port, runTailscaleCommand, {
        ownership: {
          ownerId: tailscaleOwnerId,
          runtimeDir: paths.runtimeDir,
          ownerPid: process.pid,
          pidRole: 'launcher',
        },
        userDir: process.env.MY_CODE_X_USER_DIR,
      });
      detachedEnv = {
        ...process.env,
        MY_CODE_X_TAILSCALE_MANAGED: '1',
        MY_CODE_X_TAILSCALE_DNS_NAME: tailscaleInfo.dnsName,
        MY_CODE_X_TAILSCALE_URL: tailscaleInfo.url,
        MY_CODE_X_TAILSCALE_OWNER_ID: tailscaleOwnerId,
      };
      tailscaleManaged = true;
    }

    try {
      await startDetachedSelf({ args, paths, supervisorScriptPath, env: detachedEnv });
      const state = await waitForStableState(paths.stateFile);
      if (state.status === 'failed') {
        throw new Error(state.lastError || 'supervisor failed to start');
      }

      const payload = sanitizeState(state);
      process.stdout.write(parsed.json ? `${JSON.stringify(payload)}\n` : formatStateText(payload));
    } catch (error) {
      if (tailscaleManaged) {
        await disableTailscaleServeIfOwned(runTailscaleCommand, {
          ownerId: String(detachedEnv.MY_CODE_X_TAILSCALE_OWNER_ID || '').trim(),
          userDir: detachedEnv.MY_CODE_X_USER_DIR,
        }).catch(() => {});
      }
      throw error;
    }
  } finally {
    await startLock.release();
  }
}

export async function handleStop(paths) {
  const previousState = await readJsonIfExists(paths.stateFile);
  const state = await cleanupStaleState(paths);
  if (!state?.supervisor?.pid) {
    if (previousState?.exposeMode === 'tailscale') {
      await disableTailscaleServeIfOwned(runTailscaleCommand, {
        ownerId: previousState?.provider?.ownerId,
        userDir: process.env.MY_CODE_X_USER_DIR,
      }).catch(() => {});
    }
    process.stdout.write('My-Code-X supervisor is not running.\n');
    return;
  }

  try {
    if (!state.control?.port || !state.control?.token) {
      await stopProcessByPid(state.supervisor.pid);
    } else {
      await requestControlAction(state, 'POST', '/stop');
      await waitForProcessExit(state.supervisor.pid, 20_000);
    }
  } catch (error) {
    if (!isProcessRunning(state.supervisor.pid)) {
      process.stdout.write('Stopped My-Code-X supervisor.\n');
      return;
    }

    const stopped = await stopProcessByPid(state.supervisor.pid);
    if (!stopped && isProcessRunning(state.supervisor.pid)) {
      throw error;
    }
  }

  process.stdout.write('Stopped My-Code-X supervisor.\n');
}

export async function handleStatus({ parsed, paths }) {
  const state = await cleanupStaleState(paths);
  let liveState = await reflectLiveBackendStatus(state, {
    authToken: String(process.env.MY_CODE_X_AUTH_TOKEN || '').trim(),
    timeoutMs: parseNumber(process.env.MY_CODE_X_BACKEND_WATCHDOG_TIMEOUT_MS, DEFAULT_BACKEND_WATCHDOG_TIMEOUT_MS),
    isProcessRunning,
  });

  if (liveState?.exposeMode === 'tailscale') {
    const tailscaleStatus = await probeTailscaleServe(runTailscaleCommand, {
      ownership: {
        ownerId: liveState?.provider?.ownerId,
        expectedUrl: liveState?.provider?.url || liveState?.exposureUrls?.[0] || '',
      },
      userDir: process.env.MY_CODE_X_USER_DIR,
    });

    if (!tailscaleStatus.ok) {
      liveState = {
        ...liveState,
        status: 'degraded',
        lastError:
          liveState.lastError && liveState.lastError !== tailscaleStatus.error
            ? `${liveState.lastError}; ${tailscaleStatus.error}`
            : tailscaleStatus.error,
      };
    }
  }

  const payload = sanitizeState(liveState);
  process.stdout.write(parsed.json ? `${JSON.stringify(payload)}\n` : formatStateText(payload));
}

export async function handleRestart(paths) {
  const state = await cleanupStaleState(paths);
  if (!state?.supervisor?.pid) {
    throw new Error('My-Code-X supervisor is not running.');
  }

  const payload = await requestControlAction(state, 'POST', '/restart');
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

export async function handleLogs({ parsed, paths }) {
  const state = sanitizeState(await readJsonIfExists(paths.stateFile));
  const payload = {
    runtimeDir: paths.runtimeDir,
    supervisorOutLog: paths.supervisorOutLog,
    supervisorErrLog: paths.supervisorErrLog,
    backendOutLog: paths.backendOutLog,
    backendErrLog: paths.backendErrLog,
    providerOutLog: paths.providerOutLog,
    providerErrLog: paths.providerErrLog,
    status: state.status,
  };

  if (parsed.json) {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
    return;
  }

  process.stdout.write(
    [
      `runtime dir: ${payload.runtimeDir}`,
      `supervisor stdout: ${payload.supervisorOutLog}`,
      `supervisor stderr: ${payload.supervisorErrLog}`,
      `backend stdout: ${payload.backendOutLog}`,
      `backend stderr: ${payload.backendErrLog}`,
      `provider stdout: ${payload.providerOutLog}`,
      `provider stderr: ${payload.providerErrLog}`,
    ].join('\n') + '\n',
  );
}

export function printHelp() {
  process.stdout.write(
    [
      'My-Code-X supervisor',
      '',
      'Usage:',
      '  node scripts/my-code-x-supervisor.mjs start [--expose=lan|tailscale|cloudflare] [--json]',
      '  node scripts/my-code-x-supervisor.mjs stop',
      '  node scripts/my-code-x-supervisor.mjs status [--json]',
      '  node scripts/my-code-x-supervisor.mjs restart',
      '  node scripts/my-code-x-supervisor.mjs logs [--json]',
    ].join('\n') + '\n',
  );
}
