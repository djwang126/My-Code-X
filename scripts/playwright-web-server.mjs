import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

import { buildBackendRuntime, resolveBackendDistEntry } from './shared/backend-runtime.mjs';
import { resolveSpawnInvocation } from './shared/spawn-invocation.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const backendEntry = resolveBackendDistEntry(repoRoot);

let activeChild = null;
let shuttingDown = false;

function getNpmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function spawnChild(command, args, options = {}) {
  const invocation = resolveSpawnInvocation(command, args);
  const child = spawn(invocation.command, invocation.args, {
    cwd: repoRoot,
    env: process.env,
    windowsHide: true,
    ...options,
  });

  activeChild = child;
  return child;
}

async function waitForChildExit(child) {
  const [code, signal] = await once(child, 'exit');
  if (activeChild === child) {
    activeChild = null;
  }
  return { code, signal };
}

async function runCommand(command, args, options = {}) {
  const child = spawnChild(command, args, options);
  const { code, signal } = await waitForChildExit(child);

  if (code === 0) {
    return;
  }

  if (code !== null) {
    throw new Error(`${command} exited with code ${code}`);
  }

  throw new Error(`${command} exited with signal ${signal ?? 'unknown'}`);
}

async function stopActiveChild() {
  const child = activeChild;
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  if (child.stdin && !child.stdin.destroyed) {
    child.stdin.end();
  }

  try {
    child.kill('SIGTERM');
  } catch {
    // ignore shutdown races
  }

  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      if (activeChild === child) {
        activeChild = null;
      }
      return;
    }
    await sleep(100);
  }

  if (child.exitCode === null && child.signalCode === null) {
    try {
      child.kill('SIGKILL');
    } catch {
      // ignore shutdown races
    }
    await once(child, 'exit').catch(() => {});
  }

  if (activeChild === child) {
    activeChild = null;
  }
}

async function shutdownAndExit(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  try {
    await stopActiveChild();
  } finally {
    process.exit(exitCode);
  }
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.once(signal, () => {
    shutdownAndExit(0).catch(() => {
      process.exit(1);
    });
  });
}

async function main() {
  const codexHome = String(process.env.CODEX_HOME || '').trim();
  if (codexHome) {
    await fs.mkdir(codexHome, { recursive: true });
  }

  await runCommand(getNpmCommand(), ['run', 'build', '--workspace', 'apps/web'], {
    stdio: 'inherit',
  });
  await buildBackendRuntime({ runCommand, npmCommand: getNpmCommand() });

  const backendChild = spawnChild(process.execPath, [backendEntry], {
    stdio: ['pipe', 'inherit', 'inherit'],
    env: {
      ...process.env,
      MY_CODE_X_SHUTDOWN_ON_STDIN_END: '1',
    },
  });

  const { code, signal } = await waitForChildExit(backendChild);

  if (code === 0) {
    return;
  }

  if (code !== null) {
    throw new Error(`playwright backend exited with code ${code}`);
  }

  throw new Error(`playwright backend exited with signal ${signal ?? 'unknown'}`);
}

try {
  await main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  await shutdownAndExit(1);
}
