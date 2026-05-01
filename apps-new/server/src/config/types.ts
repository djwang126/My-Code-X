import type { JsonValue } from '@my-code-x/contracts-new/json';
import type { EnvironmentVariables } from '../shared/index.js';

export interface AppConfig {
  readonly codex: CodexRuntimeConfig;
  readonly httpServer: HttpServerConfig;
}

export interface CodexRuntimeConfig {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env: EnvironmentVariables;
  readonly requestTimeoutMs: number;
  readonly dynamicTools: readonly JsonValue[];
}

export interface HttpServerConfig {
  readonly host: string;
  readonly port: number;
  readonly staticRoot: string;
  readonly bodyLimitBytes: number;
}
