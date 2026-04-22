import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  buildTailscaleInstallHelp,
  buildTailscaleLanFallbackHelp,
} from './tailscale/tailscale-bootstrap.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const launcherScriptPath = path.join(repoRoot, 'scripts', 'my-code-x-launcher.mjs');
const fakeBackendScriptPath = path.join(repoRoot, 'scripts', 'test-support', 'fake-managed-backend.mjs');
const fakeTailscaleScriptPath = path.join(repoRoot, 'scripts', 'test-support', 'fake-tailscale-cli.mjs');

async function getFreePort() {
  const { createServer } = await import('node:http');
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
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

async function runLauncherCli(args, env, { timeoutMs = 20_000 } = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [launcherScriptPath, ...args], {
      cwd: repoRoot,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      stdout += chunk;
    });
    child.stderr.on('data', chunk => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(new Error(stderr.trim() || stdout.trim() || `launcher exited with code ${code}`));
    });

    setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`launcher cli timed out after ${timeoutMs}ms`));
    }, timeoutMs).unref();
  });
}

test('launcher uses tailscale by default when it is installed, configures HTTPS Serve, and clears it on stop', async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'my-code-x-launcher-'));
  const port = await getFreePort();
  const stateFilePath = path.join(runtimeDir, 'my-code-x-state.json');
  const tailscaleStatePath = path.join(runtimeDir, 'fake-tailscale-state.json');
  const env = {
    ...process.env,
    HOST: '',
    PORT: String(port),
    MY_CODE_X_RUNTIME_DIR: runtimeDir,
    MY_CODE_X_USER_DIR: runtimeDir,
    MY_CODE_X_EXPOSE_MODE: '',
    MY_CODE_X_BACKEND_COMMAND: process.execPath,
    MY_CODE_X_BACKEND_ARGS_JSON: JSON.stringify([fakeBackendScriptPath]),
    MY_CODE_X_TAILSCALE_COMMAND: process.execPath,
    MY_CODE_X_TAILSCALE_ARGS_JSON: JSON.stringify([fakeTailscaleScriptPath]),
    MY_CODE_X_TAILSCALE_STATE_PATH: tailscaleStatePath,
    MY_CODE_X_TAILSCALE_DNS_NAME: 'my-code-x.test-tailnet.ts.net',
    MY_CODE_X_TAILSCALE_URL: '',
  };

  try {
    const result = await runLauncherCli(['start', '--no-build'], env);
    const state = await readJsonIfExists(stateFilePath);

    assert.equal(state?.status, 'healthy');
    assert.equal(state?.exposeMode, 'tailscale');
    assert.equal(state?.backend.host, '127.0.0.1');
    assert.equal(state?.provider.kind, 'tailscale');
    assert.equal(state?.provider.url, 'https://my-code-x.test-tailnet.ts.net/');
    assert.deepEqual(state?.exposureUrls, ['https://my-code-x.test-tailnet.ts.net/']);

    const serveState = await readJsonIfExists(tailscaleStatePath);
    assert.equal(serveState?.enabled, true);
    assert.deepEqual(serveState?.args, ['serve', '--bg', '--https=443', `http://127.0.0.1:${port}`]);
    assert.match(result.stdout, /My-Code-X started successfully\./i);
    assert.match(result.stdout, /mode: tailscale/i);
    assert.match(result.stdout, new RegExp(`local: http://127\\.0\\.0\\.1:${port}/`, 'i'));
    assert.match(result.stdout, /remote: https:\/\/my-code-x\.test-tailnet\.ts\.net\//i);

    await runLauncherCli(['stop'], env);

    const stoppedState = await readJsonIfExists(stateFilePath);
    assert.equal(stoppedState?.status, 'stopped');

    const disabledServeState = await readJsonIfExists(tailscaleStatePath);
    assert.equal(disabledServeState?.enabled, false);
    assert.deepEqual(disabledServeState?.args, ['serve', '--https=443', 'off']);
  } finally {
    await runLauncherCli(['stop'], env).catch(() => {});
    const state = await readJsonIfExists(stateFilePath);
    if (state?.supervisor?.pid) {
      try {
        process.kill(state.supervisor.pid, 'SIGKILL');
      } catch {
        // already gone
      }
    }
    await fs.rm(runtimeDir, { recursive: true, force: true });
  }
});

test('launcher stop only cleans up the current runtime instance', async () => {
  const runtimeDirA = await fs.mkdtemp(path.join(os.tmpdir(), 'my-code-x-launcher-a-'));
  const runtimeDirB = await fs.mkdtemp(path.join(os.tmpdir(), 'my-code-x-launcher-b-'));
  const portA = await getFreePort();
  const portB = await getFreePort();
  const stateFilePathA = path.join(runtimeDirA, 'my-code-x-state.json');
  const stateFilePathB = path.join(runtimeDirB, 'my-code-x-state.json');
  const envA = {
    ...process.env,
    PORT: String(portA),
    MY_CODE_X_RUNTIME_DIR: runtimeDirA,
    MY_CODE_X_BACKEND_COMMAND: process.execPath,
    MY_CODE_X_BACKEND_ARGS_JSON: JSON.stringify([fakeBackendScriptPath]),
    MY_CODE_X_EXPOSE_MODE: 'lan',
  };
  const envB = {
    ...process.env,
    PORT: String(portB),
    MY_CODE_X_RUNTIME_DIR: runtimeDirB,
    MY_CODE_X_BACKEND_COMMAND: process.execPath,
    MY_CODE_X_BACKEND_ARGS_JSON: JSON.stringify([fakeBackendScriptPath]),
    MY_CODE_X_EXPOSE_MODE: 'lan',
  };

  try {
    await runLauncherCli(['start', '--no-build', '--expose=lan'], envA);
    await runLauncherCli(['start', '--no-build', '--expose=lan'], envB);

    const stateA = await readJsonIfExists(stateFilePathA);
    const stateB = await readJsonIfExists(stateFilePathB);
    assert.equal(stateA?.status, 'healthy');
    assert.equal(stateB?.status, 'healthy');

    await runLauncherCli(['stop'], envA);

    const stoppedStateA = await readJsonIfExists(stateFilePathA);
    const remainingStateB = await readJsonIfExists(stateFilePathB);
    assert.equal(stoppedStateA?.status, 'stopped');
    assert.equal(isProcessRunning(stateB?.supervisor?.pid), true);
    assert.equal(isProcessRunning(stateB?.backend?.pid), true);
    assert.equal(remainingStateB?.status, 'healthy');
  } finally {
    await runLauncherCli(['stop'], envA).catch(() => {});
    await runLauncherCli(['stop'], envB).catch(() => {});
    await fs.rm(runtimeDirA, { recursive: true, force: true });
    await fs.rm(runtimeDirB, { recursive: true, force: true });
  }
});

test('launcher falls back to LAN mode when the default tailscale preference is unavailable', async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'my-code-x-launcher-'));
  const port = await getFreePort();
  const stateFilePath = path.join(runtimeDir, 'my-code-x-state.json');
  const expectedLanFallbackHelp = buildTailscaleLanFallbackHelp({ platform: process.platform });
  const env = {
    ...process.env,
    HOST: '',
    PORT: String(port),
    MY_CODE_X_RUNTIME_DIR: runtimeDir,
    MY_CODE_X_USER_DIR: runtimeDir,
    MY_CODE_X_EXPOSE_MODE: '',
    MY_CODE_X_BACKEND_COMMAND: process.execPath,
    MY_CODE_X_BACKEND_ARGS_JSON: JSON.stringify([fakeBackendScriptPath]),
    MY_CODE_X_TAILSCALE_COMMAND: path.join(runtimeDir, 'missing-tailscale-command'),
  };

  try {
    const result = await runLauncherCli(['start', '--no-build'], env);
    const state = await readJsonIfExists(stateFilePath);

    assert.equal(state?.status, 'healthy');
    assert.equal(state?.exposeMode, 'lan');
    assert.equal(state?.backend.host, '0.0.0.0');
    assert.deepEqual(state?.exposureUrls, []);
    assert.match(result.stdout, /My-Code-X started successfully\./i);
    assert.match(result.stdout, /mode: lan/i);
    assert.match(result.stdout, new RegExp(`local: http://127\\.0\\.0\\.1:${port}/`, 'i'));
    assert.match(result.stdout, /started in LAN mode instead/i);
    assert.match(result.stdout, /same local network/i);
    assert.equal(result.stdout.includes(expectedLanFallbackHelp), true);
  } finally {
    await runLauncherCli(['stop'], env).catch(() => {});
    const state = await readJsonIfExists(stateFilePath);
    if (state?.supervisor?.pid) {
      try {
        process.kill(state.supervisor.pid, 'SIGKILL');
      } catch {
        // already gone
      }
    }
    await fs.rm(runtimeDir, { recursive: true, force: true });
  }
});

test('launcher explicit tailscale start still prints a clean install guide when tailscale is missing', async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'my-code-x-launcher-'));
  const port = await getFreePort();
  const expectedInstallHelp = buildTailscaleInstallHelp({ platform: process.platform });
  const env = {
    ...process.env,
    PORT: String(port),
    MY_CODE_X_RUNTIME_DIR: runtimeDir,
    MY_CODE_X_USER_DIR: runtimeDir,
    MY_CODE_X_BACKEND_COMMAND: process.execPath,
    MY_CODE_X_BACKEND_ARGS_JSON: JSON.stringify([fakeBackendScriptPath]),
    MY_CODE_X_TAILSCALE_COMMAND: path.join(runtimeDir, 'missing-tailscale-command'),
  };

  try {
    await assert.rejects(
      () => runLauncherCli(['start', '--no-build', '--expose=tailscale'], env),
      error => {
        assert.match(error.message, /Tailscale mode requested, but Tailscale is not installed\./);
        assert.equal(error.message.includes(expectedInstallHelp), true);
        assert.doesNotMatch(error.message, /file:\/\/\/D:\//);
        assert.doesNotMatch(error.message, /Node\.js v/i);
        return true;
      },
    );
  } finally {
    await runLauncherCli(['stop'], env).catch(() => {});
    await fs.rm(runtimeDir, { recursive: true, force: true });
  }
});

test('launcher surfaces a startup failure with the real error message', async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'my-code-x-launcher-'));
  const port = await getFreePort();
  const env = {
    ...process.env,
    PORT: String(port),
    MY_CODE_X_RUNTIME_DIR: runtimeDir,
    MY_CODE_X_BACKEND_COMMAND: 'my-code-x-missing-backend-command',
    MY_CODE_X_BACKEND_ARGS_JSON: JSON.stringify([]),
    MY_CODE_X_EXPOSE_MODE: 'lan',
  };

  try {
    await assert.rejects(() => runLauncherCli(['start', '--no-build', '--expose=lan'], env), error => {
      assert.match(error.message, /My-Code-X failed to start\./);
      assert.match(error.message, /ENOENT|spawn|not recognized/i);
      return true;
    });
  } finally {
    await runLauncherCli(['stop'], env).catch(() => {});
    await fs.rm(runtimeDir, { recursive: true, force: true });
  }
});
