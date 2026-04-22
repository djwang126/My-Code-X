import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';

import { applyEnvFileToEnv, parseEnvFile } from './env-file.js';

type EnvMap = Record<string, string | undefined>;

test('parseEnvFile supports comments, export prefixes, and quoted values', () => {
  const parsed = parseEnvFile(
    [
      '# comment',
      'PORT=4410',
      'export MY_CODE_X_CODEX_IDLE_SHUTDOWN_MINUTES=15',
      'GREETING="hello\\nworld"',
      "LABEL='phone chat'",
      'INLINE=value # trailing comment',
    ].join('\n'),
  );

  assert.deepEqual(parsed, {
    PORT: '4410',
    MY_CODE_X_CODEX_IDLE_SHUTDOWN_MINUTES: '15',
    GREETING: 'hello\nworld',
    LABEL: 'phone chat',
    INLINE: 'value',
  });
});

test('applyEnvFileToEnv fills missing values without overriding explicit env', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'my-code-x-env-file-'));

  try {
    const envFilePath = path.join(tempDir, '.env');
    await writeFile(
      envFilePath,
      ['PORT=4410', 'MY_CODE_X_CODEX_IDLE_SHUTDOWN_MINUTES=12', 'MY_CODE_X_AUTH_TOKEN=from-file'].join('\n'),
      'utf8',
    );

    const env: EnvMap = {
      PORT: '5500',
      MY_CODE_X_AUTH_TOKEN: '',
    };

    applyEnvFileToEnv({ filePath: envFilePath, env });

    assert.deepEqual(env, {
      PORT: '5500',
      MY_CODE_X_CODEX_IDLE_SHUTDOWN_MINUTES: '12',
      MY_CODE_X_AUTH_TOKEN: '',
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('applyEnvFileToEnv ignores missing files', () => {
  const env: EnvMap = {};

  applyEnvFileToEnv({
    filePath: path.join(os.tmpdir(), 'my-code-x-env-file-missing', '.env'),
    env,
  });

  assert.deepEqual(env, {});
});
