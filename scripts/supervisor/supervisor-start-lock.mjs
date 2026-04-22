import fsp from 'node:fs/promises';
import process from 'node:process';

import { isProcessRunning, sleep } from '../my-code-x-managed-process.mjs';

async function readLockOwner(lockFilePath) {
  try {
    return JSON.parse(await fsp.readFile(lockFilePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null;
    }

    return null;
  }
}

async function tryAcquireStartLock(lockFilePath) {
  const handle = await fsp.open(lockFilePath, 'wx');
  let released = false;

  await handle.writeFile(
    `${JSON.stringify({
      pid: process.pid,
      createdAt: new Date().toISOString(),
    })}\n`,
    'utf8',
  );

  return {
    async release() {
      if (released) {
        return;
      }

      released = true;
      await handle.close().catch(() => {});
      await fsp.rm(lockFilePath, { force: true }).catch(() => {});
    },
  };
}

export async function acquireSupervisorStartLock(lockFilePath, { timeoutMs = 90_000, pollMs = 100 } = {}) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      return await tryAcquireStartLock(lockFilePath);
    } catch (error) {
      if (error?.code !== 'EEXIST') {
        throw error;
      }
    }

    const owner = await readLockOwner(lockFilePath);
    if (!owner?.pid || !isProcessRunning(owner.pid)) {
      await fsp.rm(lockFilePath, { force: true }).catch(() => {});
      continue;
    }

    await sleep(pollMs);
  }

  throw new Error(`timed out waiting for My-Code-X start lock: ${lockFilePath}`);
}
