import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import fsp from 'node:fs/promises';

import { resolveMyCodeXUserDir } from '@my-code-x/utils/my-code-x-user-env';
import { ensureFileParent, readJsonFileWithRetry, writeJsonFileAtomic } from './my-code-x-runtime-state.mjs';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

async function removeIfExists(filePath) {
  await fsp.rm(filePath, { force: true }).catch(error => {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  });
}

export function buildTailscaleServeOwnerPaths({ userDir = process.env.MY_CODE_X_USER_DIR || '', homeDir = os.homedir() } = {}) {
  const resolvedUserDir = resolveMyCodeXUserDir(userDir, homeDir);
  return {
    userDir: resolvedUserDir,
    ownerFile: path.join(resolvedUserDir, 'tailscale-serve-owner.json'),
    lockFile: path.join(resolvedUserDir, 'tailscale-serve-owner.lock'),
  };
}

export async function readTailscaleServeOwner({ userDir = process.env.MY_CODE_X_USER_DIR || '', homeDir = os.homedir() } = {}) {
  const paths = buildTailscaleServeOwnerPaths({ userDir, homeDir });
  return await readJsonFileWithRetry(paths.ownerFile);
}

export async function writeTailscaleServeOwner(owner, { userDir = process.env.MY_CODE_X_USER_DIR || '', homeDir = os.homedir() } = {}) {
  const paths = buildTailscaleServeOwnerPaths({ userDir, homeDir });
  await writeJsonFileAtomic(paths.ownerFile, owner);
  return owner;
}

export async function clearTailscaleServeOwner({ userDir = process.env.MY_CODE_X_USER_DIR || '', homeDir = os.homedir() } = {}) {
  const paths = buildTailscaleServeOwnerPaths({ userDir, homeDir });
  await removeIfExists(paths.ownerFile);
}

function isLockStale(lockRecord, lockStat, staleMs, isProcessRunningImpl) {
  if (!lockStat) {
    return true;
  }

  if (Date.now() - lockStat.mtimeMs < staleMs) {
    return false;
  }

  if (!lockRecord?.ownerPid) {
    return true;
  }

  return !isProcessRunningImpl(lockRecord.ownerPid);
}

export async function withTailscaleServeOwnerLock(
  callback,
  {
    userDir = process.env.MY_CODE_X_USER_DIR || '',
    homeDir = os.homedir(),
    timeoutMs = 10_000,
    pollMs = 100,
    staleMs = 30_000,
    isProcessRunningImpl = isProcessRunning,
  } = {},
) {
  const paths = buildTailscaleServeOwnerPaths({ userDir, homeDir });
  await ensureFileParent(paths.lockFile);

  const deadline = Date.now() + timeoutMs;
  let handle = null;

  while (!handle) {
    try {
      handle = await fsp.open(paths.lockFile, 'wx');
      await handle.writeFile(
        `${JSON.stringify({ ownerPid: process.pid, acquiredAt: new Date().toISOString() }, null, 2)}\n`,
        'utf8',
      );
      break;
    } catch (error) {
      if (error?.code !== 'EEXIST') {
        throw error;
      }

      const [lockRecord, lockStat] = await Promise.all([
        readJsonFileWithRetry(paths.lockFile).catch(() => null),
        fsp.stat(paths.lockFile).catch(() => null),
      ]);

      if (isLockStale(lockRecord, lockStat, staleMs, isProcessRunningImpl)) {
        await removeIfExists(paths.lockFile);
        continue;
      }

      if (Date.now() >= deadline) {
        throw new Error(`Timed out acquiring Tailscale Serve ownership lock at ${paths.lockFile}`);
      }

      await sleep(pollMs);
    }
  }

  try {
    return await callback(paths);
  } finally {
    await handle?.close().catch(() => {});
    await removeIfExists(paths.lockFile).catch(() => {});
  }
}
