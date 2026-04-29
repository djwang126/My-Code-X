import { ConfigError } from './config-error.js';
import { isJsonValue, type JsonValue } from '../shared/index.js';
import type { AppConfig } from './types.js';

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
