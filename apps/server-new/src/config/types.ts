import type { EnvironmentVariables, JsonValue } from '../shared/index.js';

export interface AppConfig {
  readonly codex: CodexRuntimeConfig;
}

export interface CodexRuntimeConfig {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env: EnvironmentVariables;
  readonly requestTimeoutMs: number;
  readonly dynamicTools: readonly JsonValue[];
}
