import fs from 'node:fs';
import fsp from 'node:fs/promises';
import process from 'node:process';
import { spawn } from 'node:child_process';

import { fetchWithTimeout } from '../my-code-x-supervisor-health.mjs';
import { ensureFileParent, readJsonFileWithRetry } from '../my-code-x-runtime-state.mjs';
import { createRunTailscaleCommand, disableTailscaleServeIfOwned } from '../tailscale-serve.mjs';
import { isProcessRunning, runCommand, sleep, stopProcessByPid } from '../my-code-x-managed-process.mjs';
import { parseNumber } from '../my-code-x-supervisor-config.mjs';
import { repoRoot } from '../my-code-x-runtime-paths.mjs';

const runTailscaleCommand = createRunTailscaleCommand({ repoRoot, runCommand });

export async function readTextIfExists(filePath) {
  try {
    return await fsp.readFile(filePath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return '';
    }

    throw error;
  }
}

export async function readJsonIfExists(filePath) {
  return await readJsonFileWithRetry(filePath);
}

export async function removeIfExists(filePath) {
  await fsp.rm(filePath, { force: true }).catch(error => {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  });
}

export async function disableManagedTailscaleServe() {
  if (String(process.env.MY_CODE_X_TAILSCALE_MANAGED || '').trim() !== '1') {
    return false;
  }

  const result = await disableTailscaleServeIfOwned(runTailscaleCommand, {
    ownerId: String(process.env.MY_CODE_X_TAILSCALE_OWNER_ID || '').trim(),
    userDir: process.env.MY_CODE_X_USER_DIR,
  });
  return result.disabled;
}

export async function startDetachedSelf({ args, paths, supervisorScriptPath, env = process.env }) {
  await ensureFileParent(paths.supervisorOutLog);
  const stdoutFd = fs.openSync(paths.supervisorOutLog, 'a');
  const stderrFd = fs.openSync(paths.supervisorErrLog, 'a');

  try {
    const child = spawn(process.execPath, [supervisorScriptPath, 'run', ...args], {
      cwd: repoRoot,
      detached: true,
      env,
      stdio: ['ignore', stdoutFd, stderrFd],
      windowsHide: true,
    });

    child.unref();
    await fsp.writeFile(paths.supervisorPid, `${child.pid}\n`, 'utf8');
    return child.pid;
  } finally {
    fs.closeSync(stdoutFd);
    fs.closeSync(stderrFd);
  }
}

export async function requestControlAction(state, method, pathname) {
  if (!state?.control?.port || !state?.control?.token) {
    throw new Error('supervisor control channel unavailable');
  }

  const response = await fetchWithTimeout(`http://127.0.0.1:${state.control.port}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-My-Code-X-Control-Token': state.control.token,
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `${pathname} failed with status ${response.status}`);
  }

  return text.trim() ? JSON.parse(text) : {};
}

export function sanitizeState(state) {
  if (!state) {
    return {
      status: 'stopped',
      supervisor: { pid: 0 },
      backend: { pid: 0, host: '', port: 0, serverInstanceId: '' },
      provider: { pid: 0, kind: '', url: '', ownerId: '' },
      exposeMode: '',
      localUrl: '',
      exposureUrls: [],
      logs: {},
      runtimeDir: '',
    };
  }

  const { control, ...rest } = state;
  void control;
  return rest;
}

export function formatStateText(state) {
  const lines = [
    `status: ${state.status}`,
    `mode: ${state.exposeMode || 'lan'}`,
    `supervisor pid: ${state.supervisor?.pid || 0}`,
    `backend pid: ${state.backend?.pid || 0}`,
    `backend url: ${state.localUrl || ''}`,
  ];

  if (state.provider?.kind) {
    lines.push(`provider: ${state.provider.kind} (${state.provider.pid || 0})`);
  }

  if (state.exposureUrls?.length) {
    lines.push(`exposure urls: ${state.exposureUrls.join(', ')}`);
  }

  if (state.lastError) {
    lines.push(`last error: ${state.lastError}`);
  }

  return `${lines.join('\n')}\n`;
}

export function buildRecoveredRunningState(paths, { supervisorPid, backendPid = 0, providerPid = 0 }) {
  return {
    status: 'starting',
    startedAt: '',
    updatedAt: '',
    exposeMode: '',
    runtimeDir: paths.runtimeDir,
    localUrl: '',
    exposureUrls: [],
    lastError: 'state file unavailable while supervisor pid is still running',
    supervisor: {
      pid: supervisorPid,
    },
    backend: {
      pid: backendPid,
      host: '',
      port: 0,
      serverInstanceId: '',
    },
    provider: {
      pid: providerPid,
      kind: '',
      url: '',
      ownerId: '',
    },
    logs: {
      supervisorOutLog: paths.supervisorOutLog,
      supervisorErrLog: paths.supervisorErrLog,
      backendOutLog: paths.backendOutLog,
      backendErrLog: paths.backendErrLog,
      providerOutLog: paths.providerOutLog,
      providerErrLog: paths.providerErrLog,
    },
    control: {
      port: 0,
      token: '',
    },
    recoveredFromPidFiles: true,
  };
}

export async function waitForStableState(stateFilePath, { timeoutMs = 20_000 } = {}) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const state = await readJsonIfExists(stateFilePath);
    if (state && ['healthy', 'degraded', 'failed', 'stopped'].includes(state.status)) {
      return state;
    }

    await sleep(100);
  }

  throw new Error(`supervisor did not reach a stable state within ${timeoutMs}ms`);
}

export async function cleanupStaleState(paths) {
  const state = await readJsonIfExists(paths.stateFile);
  const supervisorPid = state?.supervisor?.pid ?? parseNumber((await readTextIfExists(paths.supervisorPid)).trim(), 0);
  const backendPid = state?.backend?.pid ?? parseNumber((await readTextIfExists(paths.backendPid)).trim(), 0);
  const providerPid = state?.provider?.pid ?? parseNumber((await readTextIfExists(paths.providerPid)).trim(), 0);

  if (supervisorPid && isProcessRunning(supervisorPid)) {
    return state ?? buildRecoveredRunningState(paths, { supervisorPid, backendPid, providerPid });
  }

  if (state) {
    await Promise.all([stopProcessByPid(providerPid), stopProcessByPid(backendPid)]);
  }

  await Promise.all([
    removeIfExists(paths.supervisorPid),
    removeIfExists(paths.backendPid),
    removeIfExists(paths.providerPid),
    removeIfExists(paths.stateFile),
  ]);

  return null;
}

export { isProcessRunning, runTailscaleCommand };
