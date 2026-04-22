import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { mkdtempSync } from 'node:fs';
import {
  isAbsoluteUserPath,
  loadMyCodeXUserEnv,
  parseEnvFile,
  resolveMyCodeXUserDir,
} from '@my-code-x/utils/my-code-x-user-env';

test('parseEnvFile trims whitespace, skips comments, and keeps empty values', () => {
  assert.deepEqual(
    parseEnvFile(`
# comment
PORT = 4310
MY_CODE_X_AUTH_TOKEN="token"
EMPTY_VALUE=
`),
    {
      PORT: '4310',
      MY_CODE_X_AUTH_TOKEN: 'token',
      EMPTY_VALUE: '',
    },
  );
});

test('resolveMyCodeXUserDir defaults to ~/.My-Code-X and resolves relative overrides under home', () => {
  const homeDir = path.join(os.tmpdir(), 'my-code-x-home');

  assert.equal(resolveMyCodeXUserDir('', homeDir), path.join(homeDir, '.My-Code-X'));
  assert.equal(resolveMyCodeXUserDir('custom-dir', homeDir), path.join(homeDir, 'custom-dir'));
});

test('isAbsoluteUserPath and resolveMyCodeXUserDir preserve Windows absolute paths on any platform', () => {
  assert.equal(isAbsoluteUserPath('D:/users/example/.My-Code-X'), true);
  assert.equal(isAbsoluteUserPath('C:\\Users\\example\\.My-Code-X'), true);
  assert.equal(isAbsoluteUserPath('\\\\server\\share\\My-Code-X'), true);
  assert.equal(resolveMyCodeXUserDir('D:/users/example/.My-Code-X', '/home/example'), 'D:/users/example/.My-Code-X');
  assert.equal(resolveMyCodeXUserDir('C:\\Users\\example\\.My-Code-X', '/home/example'), 'C:\\Users\\example\\.My-Code-X');
});

test('loadMyCodeXUserEnv creates ~/.My-Code-X/.env from .env.example and does not override explicit env', async () => {
  const installRoot = mkdtempSync(path.join(os.tmpdir(), 'my-code-x-install-'));
  const homeDir = mkdtempSync(path.join(os.tmpdir(), 'my-code-x-home-'));
  const env = {
    PORT: '9999',
  };

  try {
    await fs.writeFile(
      path.join(installRoot, '.env.example'),
      'PORT=4310\nMY_CODE_X_CODEX_IDLE_SHUTDOWN_MINUTES=10\n',
      'utf8',
    );

    const result = loadMyCodeXUserEnv({ installRoot, homeDir, env });
    const envFilePath = path.join(homeDir, '.My-Code-X', '.env');

    assert.equal(result.created, true);
    assert.equal(result.envFile, envFilePath);
    assert.equal(env.PORT, '9999');
    assert.equal(env.MY_CODE_X_CODEX_IDLE_SHUTDOWN_MINUTES, '10');
    assert.equal(await fs.readFile(envFilePath, 'utf8'), 'PORT=4310\nMY_CODE_X_CODEX_IDLE_SHUTDOWN_MINUTES=10\n');
  } finally {
    await fs.rm(installRoot, { recursive: true, force: true });
    await fs.rm(homeDir, { recursive: true, force: true });
  }
});
