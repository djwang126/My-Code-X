import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';

import { applyEnvFileToEnv } from '@my-code-x/utils/env-file';
import {
  buildBackendRuntimeEnv,
  DEFAULT_BACKEND_STARTUP_TIMEOUT_MS,
  readSupervisorConfig,
} from './my-code-x-supervisor-config.mjs';

test('buildBackendRuntimeEnv strips inherited tailscale ownership env before launching backend children', () => {
  const result = buildBackendRuntimeEnv({
    env: {
      PATH: process.env.PATH || '',
      CUSTOM_FLAG: 'kept',
      CODEX_WORKING_DIR: 'D:/custom-worktree',
      MY_CODE_X_TAILSCALE_MANAGED: '1',
      MY_CODE_X_TAILSCALE_URL: 'https://shared.ts.net/',
      MY_CODE_X_TAILSCALE_OWNER_ID: 'owner-from-parent',
      MY_CODE_X_TAILSCALE_DNS_NAME: 'shared.ts.net',
    },
    host: '127.0.0.1',
    port: 4310,
    authToken: 'token',
    repoRoot: 'D:/workspaces/AI-Tools/My-Code-X',
    launcherScriptPath: 'D:/workspaces/AI-Tools/My-Code-X/scripts/my-code-x-launcher.mjs',
    exposeMode: 'tailscale',
    runtimeDir: 'D:/runtime/worktree-a',
  });

  assert.equal(result.CUSTOM_FLAG, 'kept');
  assert.equal(result.CODEX_WORKING_DIR, 'D:/custom-worktree');
  assert.equal(result.MY_CODE_X_EXPOSE_MODE, 'tailscale');
  assert.equal(result.MY_CODE_X_RUNTIME_DIR, 'D:/runtime/worktree-a');
  assert.equal('MY_CODE_X_TAILSCALE_MANAGED' in result, false);
  assert.equal('MY_CODE_X_TAILSCALE_URL' in result, false);
  assert.equal('MY_CODE_X_TAILSCALE_OWNER_ID' in result, false);
  assert.equal('MY_CODE_X_TAILSCALE_DNS_NAME' in result, false);
});

test('buildBackendRuntimeEnv defaults CODEX_WORKING_DIR to the My-Code-X user dir', () => {
  const result = buildBackendRuntimeEnv({
    env: {
      PATH: process.env.PATH || '',
      MY_CODE_X_USER_DIR: 'D:/users/example/.My-Code-X',
    },
    host: '127.0.0.1',
    port: 4310,
    authToken: 'token',
    repoRoot: 'D:/workspaces/AI-Tools/My-Code-X',
    launcherScriptPath: 'D:/workspaces/AI-Tools/My-Code-X/scripts/my-code-x-launcher.mjs',
    exposeMode: 'lan',
    runtimeDir: 'D:/users/example/.My-Code-X',
  });

  assert.equal(result.CODEX_WORKING_DIR, 'D:/users/example/.My-Code-X');
});

test('readSupervisorConfig uses a longer backend startup timeout by default and honors overrides', () => {
  const buildHttpUrl = (host, port) => `http://${host}:${port}/`;
  const getBindHost = (_exposeMode, requestedHost) => requestedHost || '127.0.0.1';

  const defaultConfig = readSupervisorConfig({
    env: {
      HOST: '127.0.0.1',
      PORT: '4310',
    },
    runtimeDir: 'D:/runtime/worktree-a',
    getBindHost,
    buildHttpUrl,
  });

  assert.equal(defaultConfig.backendStartupTimeoutMs, DEFAULT_BACKEND_STARTUP_TIMEOUT_MS);

  const overriddenConfig = readSupervisorConfig({
    env: {
      HOST: '127.0.0.1',
      PORT: '4310',
      MY_CODE_X_BACKEND_STARTUP_TIMEOUT_MS: '12345',
    },
    runtimeDir: 'D:/runtime/worktree-a',
    getBindHost,
    buildHttpUrl,
  });

  assert.equal(overriddenConfig.backendStartupTimeoutMs, 12_345);
});

test('readSupervisorConfig can read PORT from a .env file', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'my-code-x-supervisor-config-'));

  try {
    const envFilePath = path.join(tempDir, '.env');
    await writeFile(envFilePath, 'PORT=4510\n', 'utf8');

    const env = {
      HOST: '127.0.0.1',
    };
    applyEnvFileToEnv({ filePath: envFilePath, env });

    const config = readSupervisorConfig({
      env,
      runtimeDir: 'D:/runtime/worktree-a',
      getBindHost: (_exposeMode, requestedHost) => requestedHost || '127.0.0.1',
      buildHttpUrl: (host, port) => `http://${host}:${port}/`,
    });

    assert.equal(config.port, 4510);
    assert.equal(config.localUrl, 'http://127.0.0.1:4510/');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
