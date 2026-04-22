import fsp from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';

import { buildRuntimePaths, repoRoot, resolveRuntimeDir } from '../my-code-x-runtime-paths.mjs';
import { createRunTailscaleCommand, disableTailscaleServeIfOwned } from '../tailscale-serve.mjs';
import { readJsonFileWithRetry } from '../my-code-x-runtime-state.mjs';
import { resolveSpawnInvocation } from '../shared/spawn-invocation.mjs';
import { stopLauncherOwnedProcessRoots } from './launcher-owned-processes.mjs';

const runTailscaleCommand = createRunTailscaleCommand({ repoRoot, runCommand });

export function getLauncherPaths() {
  return buildRuntimePaths(resolveRuntimeDir());
}

export function parseNumber(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function readTextIfExists(filePath) {
  try {
    return await fsp.readFile(filePath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return '';
    }

    throw error;
  }
}

async function removeIfExists(filePath) {
  await fsp.rm(filePath, { force: true }).catch(error => {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  });
}

async function readPidFile(pidFilePath) {
  const text = (await readTextIfExists(pidFilePath)).trim();
  if (!text) {
    return null;
  }

  const pid = Number.parseInt(text, 10);
  return Number.isFinite(pid) ? pid : null;
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

async function waitForProcessExit(pid, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isProcessRunning(pid)) {
      return true;
    }

    await sleep(250);
  }

  return !isProcessRunning(pid);
}

async function stopProcessFromPidFile(pidFilePath) {
  const pid = await readPidFile(pidFilePath);
  if (!pid) {
    await removeIfExists(pidFilePath);
    return false;
  }

  if (!isProcessRunning(pid)) {
    await removeIfExists(pidFilePath);
    return false;
  }

  try {
    process.kill(pid, 'SIGTERM');
  } catch (error) {
    if (error?.code !== 'ESRCH') {
      throw error;
    }
  }

  const exitedAfterTerm = await waitForProcessExit(pid, 5_000);
  if (!exitedAfterTerm && isProcessRunning(pid)) {
    process.kill(pid, 'SIGKILL');
    await waitForProcessExit(pid, 5_000);
  }

  await removeIfExists(pidFilePath);
  return !isProcessRunning(pid);
}

async function clearManagedPidFiles() {
  const launcherPaths = getLauncherPaths();
  await Promise.all([
    removeIfExists(launcherPaths.providerPid),
    removeIfExists(launcherPaths.backendPid),
    removeIfExists(launcherPaths.supervisorPid),
  ]);
}

async function stopManagedProcesses({ allowTermination = true } = {}) {
  const launcherPaths = getLauncherPaths();
  if (!allowTermination) {
    await clearManagedPidFiles();
    return {
      providerStopped: false,
      backendStopped: false,
      supervisorStopped: false,
      pidFilesCleared: true,
    };
  }

  const providerStopped = await stopProcessFromPidFile(launcherPaths.providerPid);
  const backendStopped = await stopProcessFromPidFile(launcherPaths.backendPid);
  const supervisorStopped = await stopProcessFromPidFile(launcherPaths.supervisorPid);
  return { providerStopped, backendStopped, supervisorStopped, pidFilesCleared: false };
}

export async function runCommand(command, args, options = {}) {
  const {
    cwd = repoRoot,
    env = process.env,
    stdio = 'inherit',
    captureOutput = false,
  } = options;

  return await new Promise((resolve, reject) => {
    const invocation = resolveSpawnInvocation(command, args);
    const child = spawn(invocation.command, invocation.args, {
      cwd,
      env,
      stdio: captureOutput ? ['ignore', 'pipe', 'pipe'] : stdio,
    });

    let stdout = '';
    let stderr = '';

    if (captureOutput) {
      child.stdout?.setEncoding('utf8');
      child.stderr?.setEncoding('utf8');
      child.stdout?.on('data', chunk => {
        stdout += chunk;
      });
      child.stderr?.on('data', chunk => {
        stderr += chunk;
      });
    }

    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const error = new Error(
        captureOutput && (stderr || stdout)
          ? (stderr || stdout).trim()
          : `${command} exited with code ${code}`,
      );
      reject(error);
    });
  });
}

export async function readSupervisorState() {
  return await readJsonFileWithRetry(getLauncherPaths().stateFile);
}

export async function runSupervisorCommand(supervisorScriptPath, args, options = {}) {
  return await runCommand(process.execPath, [supervisorScriptPath, ...args], options);
}

export async function stopLauncherManagedProcesses({ existingState, stopAll = false }) {
  let legacyStopSummary = null;

  try {
    await runSupervisorCommand(path.join(repoRoot, 'scripts', 'my-code-x-supervisor.mjs'), ['stop']);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/not running/i.test(message)) {
      throw error;
    }

    legacyStopSummary = await stopManagedProcesses({ allowTermination: Boolean(existingState) });
    if (existingState?.exposeMode === 'tailscale') {
      await disableTailscaleServeIfOwned(runTailscaleCommand, {
        ownerId: existingState?.provider?.ownerId,
        userDir: process.env.MY_CODE_X_USER_DIR,
      }).catch(() => {});
    }
  }

  if (!stopAll) {
    if (legacyStopSummary) {
      process.stdout.write(`Cleaned up launcher-owned processes: ${JSON.stringify({ legacy: legacyStopSummary })}\n`);
    }
    return;
  }

  const discoveredStopSummary = await stopLauncherOwnedProcessRoots({ repoRoot });
  if (legacyStopSummary || discoveredStopSummary.stoppedRootPids.length) {
    process.stdout.write(
      `Cleaned up launcher-owned processes: ${JSON.stringify({
        legacy: legacyStopSummary,
        discoveredRootPids: discoveredStopSummary.stoppedRootPids,
      })}\n`,
    );
  }
}

