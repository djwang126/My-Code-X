import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { ConfigError, loadConfig } from './index.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const appsNewRoot = path.resolve(currentDir, '..', '..', '..');
const expectedDefaultStaticRoot = path.join(appsNewRoot, 'web', 'dist');

describe('loadConfig', () => {
  test('loads HTTP server defaults without depending on process cwd', () => {
    withEnv({}, () => {
      const config = loadConfig();

      assert.equal(config.httpServer.host, '127.0.0.1');
      assert.equal(config.httpServer.port, 4311);
      assert.equal(config.httpServer.staticRoot, expectedDefaultStaticRoot);
      assert.equal(config.httpServer.bodyLimitBytes, 1_048_576);
    });
  });

  test('allows HTTP server environment overrides', () => {
    withEnv({
      MY_CODE_X_BODY_LIMIT_BYTES: '2048',
      MY_CODE_X_HOST: '0.0.0.0',
      MY_CODE_X_PORT: '4321',
      MY_CODE_X_STATIC_ROOT: 'D:\\static-root',
    }, () => {
      const config = loadConfig();

      assert.equal(config.httpServer.host, '0.0.0.0');
      assert.equal(config.httpServer.port, 4321);
      assert.equal(config.httpServer.staticRoot, 'D:\\static-root');
      assert.equal(config.httpServer.bodyLimitBytes, 2048);
    });
  });

  test('rejects invalid numeric HTTP server config', () => {
    withEnv({
      MY_CODE_X_PORT: 'not-a-number',
    }, () => {
      assert.throws(() => loadConfig(), ConfigError);
    });

    withEnv({
      MY_CODE_X_BODY_LIMIT_BYTES: '0',
    }, () => {
      assert.throws(() => loadConfig(), ConfigError);
    });
  });
});

function withEnv(overrides: Readonly<Record<string, string>>, testBody: () => void): void {
  const names = [
    'MY_CODE_X_BODY_LIMIT_BYTES',
    'MY_CODE_X_HOST',
    'MY_CODE_X_PORT',
    'MY_CODE_X_STATIC_ROOT',
  ];
  const previousValues = new Map<string, string | undefined>();

  for (const name of names) {
    previousValues.set(name, process.env[name]);
    delete process.env[name];
  }

  try {
    Object.assign(process.env, overrides);
    testBody();
  } finally {
    for (const name of names) {
      const previousValue = previousValues.get(name);

      if (previousValue === undefined) {
        delete process.env[name];
        continue;
      }

      process.env[name] = previousValue;
    }
  }
}
