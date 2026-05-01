import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConfigError } from './config-error.js';
import { isJsonValue, type JsonValue } from '@my-code-x/contracts-new/json';
import type { AppConfig } from './types.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const appsNewRoot = path.resolve(currentDir, '..', '..', '..');
const defaultStaticRoot = path.join(appsNewRoot, 'web', 'dist');

export function loadConfig(): AppConfig {
  return {
    codex: {
      command: readStringEnv('CODEX_BIN', 'codex'),
      args: ['app-server'],
      cwd: readStringEnv('CODEX_WORKING_DIR', process.cwd()),
      env: process.env,
      requestTimeoutMs: readNumberEnv('CODEX_REQUEST_TIMEOUT_MS', 300_000),
      dynamicTools: readJsonArrayEnv('MY_CODE_X_DYNAMIC_TOOLS_JSON'),
    },
    httpServer: {
      host: readStringEnv('MY_CODE_X_HOST', '127.0.0.1'),
      port: readNumberEnv('MY_CODE_X_PORT', 4311),
      staticRoot: readStringEnv('MY_CODE_X_STATIC_ROOT', defaultStaticRoot),
      bodyLimitBytes: readNumberEnv('MY_CODE_X_BODY_LIMIT_BYTES', 1_048_576),
    },
  };
}

function readStringEnv(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
}

function readNumberEnv(name: string, fallback: number): number {
  const value = process.env[name]?.trim();

  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ConfigError(name, 'must be a positive integer');
  }

  return parsed;
}

function readJsonArrayEnv(name: string): readonly JsonValue[] {
  const value = process.env[name]?.trim();

  if (!value) {
    return [];
  }

  const parsed = parseJsonEnv(name, value);

  if (!Array.isArray(parsed)) {
    throw new ConfigError(name, 'must be a JSON array');
  }

  return parsed;
}

function parseJsonEnv(name: string, value: string): JsonValue {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ConfigError(name, `must be valid JSON: ${message}`);
  }

  if (!isJsonValue(parsed)) {
    throw new ConfigError(name, 'must contain JSON-compatible values');
  }

  return parsed;
}
