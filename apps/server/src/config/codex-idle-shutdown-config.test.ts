import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';

import { applyEnvFileToEnv } from '@my-code-x/utils/env-file';
import { readCodexIdleShutdownConfig } from './codex-idle-shutdown-config.js';

test('readCodexIdleShutdownConfig enables idle shutdown for 10 minutes when the env var is missing', () => {
  const config = readCodexIdleShutdownConfig({ env: {} });

  assert.deepEqual(config, {
    kind: 'enabled',
    idleTimeoutMinutes: 10,
    idleTimeoutMs: 600_000,
  });
});

test('readCodexIdleShutdownConfig treats an empty env var like a missing value and uses the 10-minute default', () => {
  const config = readCodexIdleShutdownConfig({
    env: { MY_CODE_X_CODEX_IDLE_SHUTDOWN_MINUTES: '   ' },
  });

  assert.deepEqual(config, {
    kind: 'enabled',
    idleTimeoutMinutes: 10,
    idleTimeoutMs: 600_000,
  });
});

test('readCodexIdleShutdownConfig disables idle shutdown when the env var is zero', () => {
  const config = readCodexIdleShutdownConfig({
    env: { MY_CODE_X_CODEX_IDLE_SHUTDOWN_MINUTES: '0' },
  });

  assert.deepEqual(config, {
    kind: 'disabled',
  });
});

test('readCodexIdleShutdownConfig disables idle shutdown when the env var is negative', () => {
  const config = readCodexIdleShutdownConfig({
    env: { MY_CODE_X_CODEX_IDLE_SHUTDOWN_MINUTES: '-5' },
  });

  assert.deepEqual(config, {
    kind: 'disabled',
  });
});

test('readCodexIdleShutdownConfig normalizes a positive configured timeout into minutes and milliseconds', () => {
  const config = readCodexIdleShutdownConfig({
    env: { MY_CODE_X_CODEX_IDLE_SHUTDOWN_MINUTES: '15' },
  });

  assert.deepEqual(config, {
    kind: 'enabled',
    idleTimeoutMinutes: 15,
    idleTimeoutMs: 900_000,
  });
});

test('readCodexIdleShutdownConfig fails clearly when the env var is not a number', () => {
  assert.throws(
    () =>
      readCodexIdleShutdownConfig({
        env: { MY_CODE_X_CODEX_IDLE_SHUTDOWN_MINUTES: 'ten' },
      }),
    error =>
      error instanceof Error &&
      error.message === 'MY_CODE_X_CODEX_IDLE_SHUTDOWN_MINUTES must be a number of minutes',
  );
});

test('readCodexIdleShutdownConfig can read idle shutdown minutes from a .env file', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'my-code-x-idle-config-'));

  try {
    const envFilePath = path.join(tempDir, '.env');
    await writeFile(envFilePath, 'MY_CODE_X_CODEX_IDLE_SHUTDOWN_MINUTES=25\n', 'utf8');

    const env = {};
    applyEnvFileToEnv({ filePath: envFilePath, env });

    const config = readCodexIdleShutdownConfig({ env });

    assert.deepEqual(config, {
      kind: 'enabled',
      idleTimeoutMinutes: 25,
      idleTimeoutMs: 1_500_000,
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
