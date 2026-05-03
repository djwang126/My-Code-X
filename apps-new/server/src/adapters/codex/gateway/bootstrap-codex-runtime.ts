import { CodexBootstrapError } from '../errors/codex-runtime-error.js';
import type { CodexJsonlTransport } from '../transport/create-jsonl-transport.js';
import type { JsonValue } from '@my-code-x/contracts-new/json';

interface RuntimeBootstrapSnapshot {
  readonly initialized: true;
  readonly models: JsonValue;
  readonly config: JsonValue;
  readonly configRequirements: JsonValue;
  readonly collaborationModes: JsonValue;
}

export interface BootstrapCodexRuntimeInput {
  readonly transport: CodexJsonlTransport;
}

export async function bootstrapCodexRuntime(input: BootstrapCodexRuntimeInput): Promise<RuntimeBootstrapSnapshot> {
  await runBootstrapRequest({
    transport: input.transport,
    method: 'initialize',
    params: {
      clientInfo: {
        name: 'my_code_x_server_new',
        title: 'My Code X server-new',
        version: '0.0.0',
      },
      capabilities: {
        experimentalApi: true,
      },
    },
  });

  await runBootstrapNotification({
    transport: input.transport,
    method: 'initialized',
    params: null,
  });

  const models = await readBootstrapValue({ transport: input.transport, method: 'model/list', params: { includeHidden: false } });
  const config = await readBootstrapValue({ transport: input.transport, method: 'config/read', params: {} });
  const configRequirements = await readBootstrapValue({
    transport: input.transport,
    method: 'configRequirements/read',
    params: {},
  });
  const collaborationModes = await readBootstrapValue({
    transport: input.transport,
    method: 'collaborationMode/list',
    params: {},
  });

  return {
    initialized: true,
    models,
    config,
    configRequirements,
    collaborationModes,
  };
}

interface ReadBootstrapValueInput {
  readonly transport: CodexJsonlTransport;
  readonly method: string;
  readonly params: { readonly [key: string]: JsonValue };
}

async function readBootstrapValue(input: ReadBootstrapValueInput): Promise<JsonValue> {
  return runBootstrapRequest(input);
}

async function runBootstrapRequest(input: ReadBootstrapValueInput): Promise<JsonValue> {
  try {
    return await input.transport.request({ method: input.method, params: input.params });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CodexBootstrapError(`${input.method} failed during Codex bootstrap: ${message}`);
  }
}

interface RunBootstrapNotificationInput {
  readonly transport: CodexJsonlTransport;
  readonly method: string;
  readonly params: null;
}

async function runBootstrapNotification(input: RunBootstrapNotificationInput): Promise<void> {
  try {
    await input.transport.notify({ method: input.method, params: input.params });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CodexBootstrapError(`${input.method} failed during Codex bootstrap: ${message}`);
  }
}
