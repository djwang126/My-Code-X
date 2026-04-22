import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { buildTailscaleInstallHelp } from './tailscale/tailscale-bootstrap.mjs';
import {
  fakeBackendScriptPath,
  fakeProviderScriptPath,
  fakeTailscaleScriptPath,
  getFreePort,
  readJsonIfExists,
  runSupervisorCli,
  runSupervisorCliJson,
  stopSupervisorFromStateFile,
  waitFor,
} from './test-support/my-code-x-supervisor-test-helpers.mjs';

test('supervisor restarts a managed cloudflare provider after it exits', async () => {
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
    MY_CODE_X_PROVIDER_COMMAND: process.execPath,
    MY_CODE_X_PROVIDER_ARGS_JSON: JSON.stringify([fakeProviderScriptPath]),
    MY_CODE_X_PROVIDER_URL: 'https://first-provider.trycloudflare.com',
  };

  try {
    const startResult = await runSupervisorCliJson(['start', '--json', '--expose=cloudflare'], env);
    const initialState = startResult.json;

    process.kill(initialState.provider.pid, 'SIGTERM');

    const restartedProviderState = await waitFor(async () => {
      const next = await readJsonIfExists(stateFilePath);
      if (!next?.provider?.pid || next.provider.pid === initialState.provider.pid) {
        return null;
      }
      return next.provider.url && next.exposureUrls?.length ? next : null;
    });

    assert.notEqual(restartedProviderState.provider.pid, initialState.provider.pid);
    assert.equal(restartedProviderState.provider.url, 'https://first-provider.trycloudflare.com');
    assert.equal(restartedProviderState.status, 'healthy');

    await stopSupervisorFromStateFile(stateFilePath);
  } finally {
    await fs.rm(runtimeDir, { recursive: true, force: true });
  }
});

test('supervisor direct tailscale mode configures HTTPS Serve and clears it on stop', async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'my-code-x-supervisor-'));
  const port = await getFreePort();
  const stateFilePath = path.join(runtimeDir, 'my-code-x-state.json');
  const tailscaleStatePath = path.join(runtimeDir, 'fake-tailscale-state.json');
  const env = {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: String(port),
    MY_CODE_X_RUNTIME_DIR: runtimeDir,
    MY_CODE_X_USER_DIR: runtimeDir,
    MY_CODE_X_EXPOSE_MODE: 'tailscale',
    MY_CODE_X_BACKEND_COMMAND: process.execPath,
    MY_CODE_X_BACKEND_ARGS_JSON: JSON.stringify([fakeBackendScriptPath]),
    MY_CODE_X_TAILSCALE_COMMAND: process.execPath,
    MY_CODE_X_TAILSCALE_ARGS_JSON: JSON.stringify([fakeTailscaleScriptPath]),
    MY_CODE_X_TAILSCALE_STATE_PATH: tailscaleStatePath,
    MY_CODE_X_TAILSCALE_DNS_NAME: 'my-code-x.test-tailnet.ts.net',
    MY_CODE_X_TAILSCALE_URL: '',
  };

  try {
    const { json: state } = await runSupervisorCliJson(['start', '--json', '--expose=tailscale'], env);

    assert.equal(state.exposeMode, 'tailscale');
    assert.equal(state.backend.host, '127.0.0.1');
    assert.equal(state.provider.kind, 'tailscale');
    assert.equal(state.provider.url, 'https://my-code-x.test-tailnet.ts.net/');
    assert.equal(typeof state.provider.ownerId, 'string');
    assert.deepEqual(state.exposureUrls, ['https://my-code-x.test-tailnet.ts.net/']);

    const serveState = await readJsonIfExists(tailscaleStatePath);
    assert.equal(serveState.enabled, true);
    assert.deepEqual(serveState.args, ['serve', '--bg', '--https=443', `http://127.0.0.1:${port}`]);

    await stopSupervisorFromStateFile(stateFilePath);
    const stoppedState = await waitFor(() => readJsonIfExists(stateFilePath).then(next => next?.status === 'stopped' ? next : null));
    assert.equal(stoppedState.status, 'stopped');

    const disabledServeState = await readJsonIfExists(tailscaleStatePath);
    assert.equal(disabledServeState.enabled, false);
    assert.deepEqual(disabledServeState.args, ['serve', '--https=443', 'off']);
  } finally {
    await runSupervisorCli(['stop'], env).catch(() => {});
    await fs.rm(runtimeDir, { recursive: true, force: true });
  }
});

test('supervisor stop does not disable tailscale serve owned by another runtime', async () => {
  const sharedUserDir = await fs.mkdtemp(path.join(os.tmpdir(), 'my-code-x-user-'));
  const runtimeDirA = await fs.mkdtemp(path.join(os.tmpdir(), 'my-code-x-supervisor-a-'));
  const runtimeDirB = await fs.mkdtemp(path.join(os.tmpdir(), 'my-code-x-supervisor-b-'));
  const port = await getFreePort();
  const tailscaleStatePath = path.join(sharedUserDir, 'fake-tailscale-state.json');
  const stateFilePathB = path.join(runtimeDirB, 'my-code-x-state.json');
  const envA = {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: String(port),
    MY_CODE_X_RUNTIME_DIR: runtimeDirA,
    MY_CODE_X_USER_DIR: sharedUserDir,
    MY_CODE_X_BACKEND_COMMAND: process.execPath,
    MY_CODE_X_BACKEND_ARGS_JSON: JSON.stringify([fakeBackendScriptPath]),
    MY_CODE_X_TAILSCALE_COMMAND: process.execPath,
    MY_CODE_X_TAILSCALE_ARGS_JSON: JSON.stringify([fakeTailscaleScriptPath]),
    MY_CODE_X_TAILSCALE_STATE_PATH: tailscaleStatePath,
    MY_CODE_X_TAILSCALE_DNS_NAME: 'my-code-x.test-tailnet.ts.net',
    MY_CODE_X_TAILSCALE_URL: '',
  };
  const envB = {
    ...process.env,
    PORT: String(port),
    MY_CODE_X_RUNTIME_DIR: runtimeDirB,
    MY_CODE_X_USER_DIR: sharedUserDir,
    MY_CODE_X_TAILSCALE_COMMAND: process.execPath,
    MY_CODE_X_TAILSCALE_ARGS_JSON: JSON.stringify([fakeTailscaleScriptPath]),
    MY_CODE_X_TAILSCALE_STATE_PATH: tailscaleStatePath,
    MY_CODE_X_TAILSCALE_DNS_NAME: 'my-code-x.test-tailnet.ts.net',
    MY_CODE_X_TAILSCALE_URL: '',
  };

  try {
    const { json: stateA } = await runSupervisorCliJson(['start', '--json', '--expose=tailscale'], envA);

    await fs.writeFile(
      stateFilePathB,
      `${JSON.stringify(
        {
          status: 'stopped',
          exposeMode: 'tailscale',
          runtimeDir: runtimeDirB,
          localUrl: `http://127.0.0.1:${port}/`,
          exposureUrls: ['https://my-code-x.test-tailnet.ts.net/'],
          lastError: '',
          supervisor: { pid: 999999 },
          backend: { pid: 0, host: '127.0.0.1', port, serverInstanceId: '' },
          provider: {
            pid: 0,
            kind: 'tailscale',
            url: 'https://my-code-x.test-tailnet.ts.net/',
            ownerId: 'different-owner',
          },
          control: { port: 0, token: '' },
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    await runSupervisorCli(['stop'], envB);

    const serveState = await readJsonIfExists(tailscaleStatePath);
    assert.equal(serveState.enabled, true);
    assert.deepEqual(serveState.args, ['serve', '--bg', '--https=443', `http://127.0.0.1:${port}`]);

    const stateAOwnerId = stateA.provider?.ownerId;
    assert.equal(typeof stateAOwnerId, 'string');
    assert.notEqual(stateAOwnerId, 'different-owner');

    await stopSupervisorFromStateFile(path.join(runtimeDirA, 'my-code-x-state.json'));
  } finally {
    await runSupervisorCli(['stop'], envA).catch(() => {});
    await fs.rm(sharedUserDir, { recursive: true, force: true });
    await fs.rm(runtimeDirA, { recursive: true, force: true });
    await fs.rm(runtimeDirB, { recursive: true, force: true });
  }
});

test('supervisor tailscale start prints platform install guidance when tailscale is missing', async () => {
  const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'my-code-x-supervisor-'));
  const port = await getFreePort();
  const expectedInstallHelp = buildTailscaleInstallHelp({ platform: process.platform });
  const env = {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: String(port),
    MY_CODE_X_RUNTIME_DIR: runtimeDir,
    MY_CODE_X_USER_DIR: runtimeDir,
    MY_CODE_X_BACKEND_COMMAND: process.execPath,
    MY_CODE_X_BACKEND_ARGS_JSON: JSON.stringify([fakeBackendScriptPath]),
    MY_CODE_X_TAILSCALE_COMMAND: path.join(runtimeDir, 'missing-tailscale-command'),
  };

  try {
    await assert.rejects(
      () => runSupervisorCli(['start', '--json', '--expose=tailscale'], env),
      error =>
        /Tailscale mode requested, but Tailscale is not installed\./.test(error.message) &&
        error.message.includes(expectedInstallHelp),
    );
  } finally {
    await runSupervisorCli(['stop'], env).catch(() => {});
    await fs.rm(runtimeDir, { recursive: true, force: true });
  }
});
