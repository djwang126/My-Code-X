import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

import {
  fakeBackendScriptPath,
  launcherScriptPath,
  getFreePort,
  readJsonIfExists,
  readTextIfExists,
  repoRoot,
  runSupervisorCli,
  runSupervisorCliJson,
  runSupervisorLanCli,
  spawnNodeProcess,
  stopSupervisorFromStateFile,
  waitFor,
} from './test-support/my-code-x-supervisor-test-helpers.mjs';

test('supervisor start/status/stop manages a backend process in a dedicated runtime dir', async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'my-code-x-supervisor-'));
  const port = await getFreePort();
  const stateFilePath = path.join(runtimeDir, 'my-code-x-state.json');
  const env = {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: String(port),
    MY_CODE_X_RUNTIME_DIR: runtimeDir,
    MY_CODE_X_EXPOSE_MODE: 'lan',
    MY_CODE_X_BACKEND_COMMAND: process.execPath,
    MY_CODE_X_BACKEND_ARGS_JSON: JSON.stringify([fakeBackendScriptPath]),
    MY_CODE_X_TAILSCALE_URL: '',
  };

  try {
    const { json: state } = await runSupervisorCliJson(['start', '--json', '--expose=lan'], env);

    assert.equal(state.exposeMode, 'lan');
    assert.equal(state.backend.host, '127.0.0.1');
    assert.equal(state.backend.port, port);
    assert.ok(Number.isInteger(state.supervisor.pid));
    assert.ok(Number.isInteger(state.backend.pid));

    const statusResult = await runSupervisorCliJson(['status', '--json'], env);
    const status = statusResult.json;
    assert.equal(status.status, 'healthy');
    assert.equal(status.backend.pid, state.backend.pid);

    const stopResult = await runSupervisorCli(['stop'], env);
    assert.equal(stopResult.stderr.trim(), '');
    const stoppedState = await waitFor(() => readJsonIfExists(stateFilePath).then(next => next?.status === 'stopped' ? next : null));
    assert.equal(stoppedState.status, 'stopped');
  } finally {
    await fs.rm(runtimeDir, { recursive: true, force: true });
  }
});

test('supervisor concurrent start serializes to a single live instance', async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'my-code-x-supervisor-'));
  const port = await getFreePort();
  const stateFilePath = path.join(runtimeDir, 'my-code-x-state.json');
  const env = {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: String(port),
    MY_CODE_X_RUNTIME_DIR: runtimeDir,
    MY_CODE_X_EXPOSE_MODE: 'lan',
    MY_CODE_X_BACKEND_COMMAND: process.execPath,
    MY_CODE_X_BACKEND_ARGS_JSON: JSON.stringify([fakeBackendScriptPath]),
  };

  try {
    const [firstStart, secondStart] = await Promise.all([
      runSupervisorCliJson(['start', '--json', '--expose=lan'], env),
      runSupervisorCliJson(['start', '--json', '--expose=lan'], env),
    ]);

    assert.equal(firstStart.json?.supervisor?.pid, secondStart.json?.supervisor?.pid);
    assert.equal(firstStart.json?.backend?.pid, secondStart.json?.backend?.pid);

    const persistedState = await readJsonIfExists(stateFilePath);
    assert.equal(persistedState?.supervisor?.pid, firstStart.json?.supervisor?.pid);
    assert.equal(persistedState?.backend?.pid, firstStart.json?.backend?.pid);

    await stopSupervisorFromStateFile(stateFilePath);
  } finally {
    await runSupervisorCli(['stop'], env).catch(() => {});
    await fs.rm(runtimeDir, { recursive: true, force: true });
  }
});

test('supervisor health checks and advertised local URL follow an explicit HOST override', async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'my-code-x-supervisor-'));
  const port = await getFreePort();
  const stateFilePath = path.join(runtimeDir, 'my-code-x-state.json');
  const env = {
    ...process.env,
    HOST: '127.0.0.2',
    PORT: String(port),
    MY_CODE_X_RUNTIME_DIR: runtimeDir,
    MY_CODE_X_BACKEND_COMMAND: process.execPath,
    MY_CODE_X_BACKEND_ARGS_JSON: JSON.stringify([fakeBackendScriptPath]),
  };

  try {
    const { json: state } = await runSupervisorCliJson(['start', '--json', '--expose=lan'], env);

    assert.equal(state.backend.host, '127.0.0.2');
    assert.equal(state.localUrl, `http://127.0.0.2:${port}/`);

    const healthResponse = await fetch(new URL('/api/health', state.localUrl));
    assert.equal(healthResponse.status, 200);
    assert.equal((await healthResponse.json()).ok, true);

    await stopSupervisorFromStateFile(stateFilePath);
  } finally {
    await runSupervisorCli(['stop'], env).catch(() => {});
    await fs.rm(runtimeDir, { recursive: true, force: true });
  }
});

test('supervisor restarts the backend after a crash and on explicit restart', async () => {
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
  };

  try {
    const { json: initialState } = await runSupervisorCliJson(['start', '--json', '--expose=lan'], env);

    process.kill(initialState.backend.pid, 'SIGTERM');

    const restartedAfterCrash = await waitFor(async () => {
      const next = await readJsonIfExists(stateFilePath);
      if (!next || next.status !== 'healthy') {
        return null;
      }
      return next.backend.pid !== initialState.backend.pid ? next : null;
    });

    assert.notEqual(restartedAfterCrash.backend.pid, initialState.backend.pid);

    const restartResult = await runSupervisorCli(['restart'], env);
    assert.equal(restartResult.stderr.trim(), '');

    const restartedAfterExplicitRestart = await waitFor(async () => {
      const next = await readJsonIfExists(stateFilePath);
      if (!next || next.status !== 'healthy') {
        return null;
      }
      return next.backend.pid !== restartedAfterCrash.backend.pid ? next : null;
    });

    assert.notEqual(restartedAfterExplicitRestart.backend.pid, restartedAfterCrash.backend.pid);

    const stopResult = await runSupervisorCli(['stop'], env);
    assert.equal(stopResult.stderr.trim(), '');
    await waitFor(() => readJsonIfExists(stateFilePath).then(next => next?.status === 'stopped' ? next : null));
  } finally {
    await fs.rm(runtimeDir, { recursive: true, force: true });
  }
});

test('launcher restart handoff delegates to the running supervisor', async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'my-code-x-supervisor-'));
  const distDirPath = path.join(repoRoot, 'apps', 'web', 'dist');
  const distIndexPath = path.join(distDirPath, 'index.html');
  const backupDistDirPath = path.join(repoRoot, 'apps', 'web', `dist.__backup__handoff__${process.pid}`);
  const port = await getFreePort();
  const stateFilePath = path.join(runtimeDir, 'my-code-x-state.json');
  const env = {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: String(port),
    MY_CODE_X_RUNTIME_DIR: runtimeDir,
    MY_CODE_X_BACKEND_COMMAND: process.execPath,
    MY_CODE_X_BACKEND_ARGS_JSON: JSON.stringify([fakeBackendScriptPath]),
  };

  try {
    const { json: initialState } = await runSupervisorCliJson(['start', '--json', '--expose=lan'], env);

    const distExists = await fs.stat(distDirPath).then(() => true).catch(error => {
      if (error?.code === 'ENOENT') {
        return false;
      }
      throw error;
    });
    await fs.rm(backupDistDirPath, { recursive: true, force: true });
    if (distExists) {
      await fs.rename(distDirPath, backupDistDirPath);
    }

    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [launcherScriptPath], {
        cwd: repoRoot,
        env: {
          ...env,
          WEB_CODEX_RESTART_SHUTDOWN_TOKEN: 'restart-token',
          MY_CODE_X_EXPOSE_MODE: 'lan',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderr = '';
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', chunk => {
        stderr += chunk;
      });
      child.on('error', reject);
      child.on('exit', code => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(stderr.trim() || `launcher handoff exited with code ${code}`));
      });
    });

    const restartedState = await waitFor(async () => {
      const next = await readJsonIfExists(stateFilePath);
      if (!next || next.status !== 'healthy') {
        return null;
      }
      return next.backend.pid !== initialState.backend.pid ? next : null;
    });

    assert.notEqual(restartedState.backend.pid, initialState.backend.pid);
    const distIndex = await fs.readFile(distIndexPath, 'utf8');
    assert.match(distIndex, /<!doctype html>/i);

    await stopSupervisorFromStateFile(stateFilePath);
  } finally {
    await fs.rm(distDirPath, { recursive: true, force: true });
    await fs.rename(backupDistDirPath, distDirPath).catch(() => {});
    await fs.rm(runtimeDir, { recursive: true, force: true });
  }
});

test('supervisor start cleans up stale backend ownership before launching a replacement', async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'my-code-x-supervisor-'));
  const port = await getFreePort();
  const stateFilePath = path.join(runtimeDir, 'my-code-x-state.json');
  const staleBackendPidPath = path.join(runtimeDir, 'my-code-x-backend.pid');
  const staleState = {
    status: 'healthy',
    supervisor: { pid: 999999 },
    backend: { pid: 0, host: '127.0.0.1', port, serverInstanceId: '' },
    provider: { pid: 0, kind: '', url: '' },
    control: { port: 0, token: '' },
  };
  const env = {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: String(port),
    MY_CODE_X_RUNTIME_DIR: runtimeDir,
    MY_CODE_X_BACKEND_COMMAND: process.execPath,
    MY_CODE_X_BACKEND_ARGS_JSON: JSON.stringify([fakeBackendScriptPath]),
  };

  const staleBackend = spawnNodeProcess(fakeBackendScriptPath, env);

  try {
    await waitFor(async () => {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/health`);
        return response.ok;
      } catch {
        return false;
      }
    });

    staleState.backend.pid = staleBackend.pid;
    await fs.writeFile(stateFilePath, `${JSON.stringify(staleState, null, 2)}\n`, 'utf8');
    await fs.writeFile(staleBackendPidPath, `${staleBackend.pid}\n`, 'utf8');

    const { json: state } = await runSupervisorCliJson(['start', '--json', '--expose=lan'], env);

    assert.notEqual(state.backend.pid, staleBackend.pid);
    assert.equal(staleBackend.killed || staleBackend.exitCode !== null || staleBackend.signalCode !== null, true);

    await stopSupervisorFromStateFile(stateFilePath);
  } finally {
    if (staleBackend.exitCode === null && staleBackend.signalCode === null) {
      staleBackend.kill('SIGKILL');
      await once(staleBackend, 'exit').catch(() => {});
    }
    await fs.rm(runtimeDir, { recursive: true, force: true });
  }
});

test('supervisor explicit restart does not race itself into a duplicate backend launch', async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'my-code-x-supervisor-'));
  const port = await getFreePort();
  const stateFilePath = path.join(runtimeDir, 'my-code-x-state.json');
  const backendErrLogPath = path.join(runtimeDir, 'my-code-x-backend.err.log');
  const env = {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: String(port),
    MY_CODE_X_RUNTIME_DIR: runtimeDir,
    MY_CODE_X_BACKEND_COMMAND: process.execPath,
    MY_CODE_X_BACKEND_ARGS_JSON: JSON.stringify([fakeBackendScriptPath]),
  };

  try {
    const initialStart = await runSupervisorCliJson(['start', '--json', '--expose=lan'], env);
    let currentState = initialStart.json;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const restartResult = await runSupervisorCli(['restart'], env);
      assert.equal(restartResult.stderr.trim(), '');

      const restartedState = await waitFor(async () => {
        const next = await readJsonIfExists(stateFilePath);
        if (!next || next.status !== 'healthy') {
          return null;
        }
        return next.backend.pid !== currentState.backend.pid ? next : null;
      });

      assert.notEqual(restartedState.backend.pid, currentState.backend.pid);
      currentState = restartedState;
    }

    const backendErrLog = await readTextIfExists(backendErrLogPath);
    assert.equal(
      backendErrLog.includes('EADDRINUSE'),
      false,
      `explicit restart should not overlap backend launches:\n${backendErrLog}`,
    );

    await stopSupervisorFromStateFile(stateFilePath);
  } finally {
    await fs.rm(runtimeDir, { recursive: true, force: true });
  }
});

test('supervisor start reuses a live pidfile-backed instance when the state file is temporarily missing', async () => {
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
  };

  try {
    const { json: initialState } = await runSupervisorCliJson(['start', '--json', '--expose=lan'], env);

    await fs.rm(stateFilePath, { force: true });

    const startResult = await runSupervisorCliJson(['start', '--json'], env, { timeoutMs: 3_000 });
    const restartedState = startResult.json;
    assert.equal(restartedState.supervisor.pid, initialState.supervisor.pid);
    assert.equal(restartedState.backend.pid, initialState.backend.pid);

    await runSupervisorCli(['stop'], env);
  } finally {
    await runSupervisorCli(['stop'], env).catch(() => {});
    await fs.rm(runtimeDir, { recursive: true, force: true });
  }
});

test('supervisor start fails fast when the backend command cannot be spawned', async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'my-code-x-supervisor-'));
  const port = await getFreePort();
  const env = {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: String(port),
    MY_CODE_X_RUNTIME_DIR: runtimeDir,
    MY_CODE_X_BACKEND_COMMAND: 'my-code-x-missing-backend-command',
    MY_CODE_X_BACKEND_ARGS_JSON: JSON.stringify([]),
  };

  try {
    await assert.rejects(
      () => runSupervisorLanCli(['start', '--json'], env, { timeoutMs: 3_000 }),
      error => {
        assert.match(error.message, /ENOENT|spawn|not recognized/i);
        assert.equal(/timed out/i.test(error.message), false);
        return true;
      },
    );
  } finally {
    await runSupervisorCli(['stop'], env).catch(() => {});
    await fs.rm(runtimeDir, { recursive: true, force: true });
  }
});
