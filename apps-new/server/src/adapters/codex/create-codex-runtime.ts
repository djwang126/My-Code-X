import { bootstrapCodexRuntime } from './protocol/bootstrap-codex-runtime.js';
import { createCodexRuntimeClient } from './runtime/create-codex-runtime-client.js';
import { createStderrCodexRuntimeLogger, type CodexRuntimeLogger } from './runtime/codex-runtime-logger.js';
import { createJsonlTransport } from './transport/create-jsonl-transport.js';
import type { RuntimePort } from '../../ports/index.js';
import type { JsonValue } from '@my-code-x/contracts-new/json';
import type { EnvironmentVariables } from '../../shared/index.js';

export interface CodexRuntimeOptions {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env: EnvironmentVariables;
  readonly requestTimeoutMs: number;
  readonly dynamicTools: readonly JsonValue[];
}

export interface CodexRuntimeInput {
  readonly options: CodexRuntimeOptions;
  readonly logger?: CodexRuntimeLogger;
}

export async function createCodexRuntime(input: CodexRuntimeInput): Promise<RuntimePort> {
  const logger = input.logger ?? createStderrCodexRuntimeLogger();
  const transport = createJsonlTransport({
    command: input.options.command,
    args: input.options.args,
    cwd: input.options.cwd,
    env: input.options.env,
    requestTimeoutMs: input.options.requestTimeoutMs,
  });

  try {
    await bootstrapCodexRuntime({ transport });
    return createCodexRuntimeClient({
      transport,
      dynamicTools: input.options.dynamicTools,
      logger,
    });
  } catch (error) {
    await transport.close().catch(() => {});
    throw error;
  }
}
