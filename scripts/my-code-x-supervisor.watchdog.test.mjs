import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import {
  fakeBackendScriptPath,
  fakeTailscaleScriptPath,
  getFreePort,
  readJsonIfExists,
  runSupervisorCli,
  runSupervisorCliJson,
  stopSupervisorFromStateFile,
  waitFor,
} from './test-support/my-code-x-supervisor-test-helpers.mjs';

test('supervisor health checks honor an auth-protected backend', async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'my-code-x-supervisor-'));
  const port = await getFreePort();
  const stateFilePath = path.join(runtimeDir, 'my-code-x-state.json');
  const env = {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: String(port),
    MY_CODE_X_RUNTIME_DIR: runtimeDir,
    MY_CODE_X_AUTH_TOKEN: 'session-auth',
    MY_CODE_X_BACKEND_COMMAND: process.execPath,
    MY_CODE_X_BACKEND_ARGS_JSON: JSON.stringify([fakeBackendScriptPath]),
  };

  try {
    const { json: state } = await runSupervisorCliJson(['start', '--json', '--expose=lan'], env);

    assert.ok(Number.isInteger(state.backend.pid));

    const statusResult = await runSupervisorCliJson(['status', '--json'], env);
    const status = statusResult.json;
    assert.equal(status.status, 'healthy');

    await stopSupervisorFromStateFile(stateFilePath);
  } finally {
    await runSupervisorCli(['stop'], env).catch(() => {});
    await fs.rm(runtimeDir, { recursive: true, force: true });
  }
});

test('supervisor status reports degraded when the backend stops answering health checks', async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'my-code-x-supervisor-'));
  const port = await getFreePort();
  const stateFilePath = path.join(runtimeDir, 'my-code-x-state.json');
  const env = {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: String(port),
    MY_CODE_X_RUNTIME_DIR: runtimeDir,
    MY_CODE_X_BACKEND_COMMAND: process.execPath,
    MY_CODE_X_BACKEND_ARGS_JSON: JSON.stringify([fakeBackendScriptPath]),
    MY_CODE_X_FAKE_BACKEND_HANG_AFTER_MS: '250',
    MY_CODE_X_BACKEND_WATCHDOG_TIMEOUT_MS: '100',
    MY_CODE_X_BACKEND_WATCHDOG_INTERVAL_MS: '0',
  };

  try {
    const { json: initialState } = await runSupervisorCliJson(['start', '--json', '--expose=lan'], env);

    const degradedStatus = await waitFor(async () => {
      const statusResult = await runSupervisorCliJson(['status', '--json'], env, { timeoutMs: 3_000 });
      const status = statusResult.json;
      return status.status === 'degraded' ? status : null;
    }, { timeoutMs: 4_000, intervalMs: 100 });

    assert.equal(degradedStatus.backend.pid, initialState.backend.pid);
    assert.match(degradedStatus.lastError, /health check|timed out/i);

    await stopSupervisorFromStateFile(stateFilePath);
  } finally {
    await runSupervisorCli(['stop'], env).catch(() => {});
    await fs.rm(runtimeDir, { recursive: true, force: true });
  }
});

test('supervisor restarts a managed backend that becomes unresponsive without exiting', async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'my-code-x-supervisor-'));
  const port = await getFreePort();
  const stateFilePath = path.join(runtimeDir, 'my-code-x-state.json');
  const env = {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: String(port),
    MY_CODE_X_RUNTIME_DIR: runtimeDir,
    MY_CODE_X_BACKEND_COMMAND: process.execPath,
    MY_CODE_X_BACKEND_ARGS_JSON: JSON.stringify([fakeBackendScriptPath]),
    MY_CODE_X_FAKE_BACKEND_HANG_AFTER_MS: '300',
    MY_CODE_X_BACKEND_WATCHDOG_INTERVAL_MS: '100',
    MY_CODE_X_BACKEND_WATCHDOG_FAILURE_THRESHOLD: '2',
    MY_CODE_X_BACKEND_WATCHDOG_TIMEOUT_MS: '100',
  };

  try {
    const { json: initialState } = await runSupervisorCliJson(['start', '--json', '--expose=lan'], env);

    const restartedState = await waitFor(async () => {
      const next = await readJsonIfExists(stateFilePath);
      if (!next || next.status !== 'healthy') {
        return null;
      }

      return next.backend.pid !== initialState.backend.pid ? next : null;
    }, { timeoutMs: 5_000, intervalMs: 50 });

    assert.notEqual(restartedState.backend.pid, initialState.backend.pid);

    await stopSupervisorFromStateFile(stateFilePath);
  } finally {
    await runSupervisorCli(['stop'], env).catch(() => {});
    await fs.rm(runtimeDir, { recursive: true, force: true });
  }
});

test('supervisor status reports degraded when tailscale serve config disappears', async () => {
  const sharedUserDir = await fs.mkdtemp(path.join(os.tmpdir(), 'my-code-x-user-'));
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'my-code-x-supervisor-'));
  const port = await getFreePort();
  const stateFilePath = path.join(runtimeDir, 'my-code-x-state.json');
  const tailscaleStatePath = path.join(sharedUserDir, 'fake-tailscale-state.json');
  const env = {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: String(port),
    MY_CODE_X_RUNTIME_DIR: runtimeDir,
    MY_CODE_X_USER_DIR: sharedUserDir,
    MY_CODE_X_BACKEND_COMMAND: process.execPath,
    MY_CODE_X_BACKEND_ARGS_JSON: JSON.stringify([fakeBackendScriptPath]),
    MY_CODE_X_TAILSCALE_COMMAND: process.execPath,
    MY_CODE_X_TAILSCALE_ARGS_JSON: JSON.stringify([fakeTailscaleScriptPath]),
    MY_CODE_X_TAILSCALE_STATE_PATH: tailscaleStatePath,
    MY_CODE_X_TAILSCALE_DNS_NAME: 'my-code-x.test-tailnet.ts.net',
  };

  try {
    await runSupervisorCliJson(['start', '--json', '--expose=tailscale'], env);

    await fs.writeFile(
      tailscaleStatePath,
      `${JSON.stringify({ enabled: false, args: ['serve', '--https=443', 'off'] }, null, 2)}\n`,
      'utf8',
    );

    const degradedStatus = await waitFor(async () => {
      const statusResult = await runSupervisorCliJson(['status', '--json'], env, { timeoutMs: 3_000 });
      const status = statusResult.json;
      return status.status === 'degraded' ? status : null;
    }, { timeoutMs: 4_000, intervalMs: 100 });

    assert.match(degradedStatus.lastError, /tailscale serve/i);

    await stopSupervisorFromStateFile(stateFilePath);
  } finally {
    await runSupervisorCli(['stop'], env).catch(() => {});
    await fs.rm(sharedUserDir, { recursive: true, force: true });
    await fs.rm(runtimeDir, { recursive: true, force: true });
  }
});
