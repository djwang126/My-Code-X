import { createCodexTransport } from './codex-transport.js';
import type { RuntimeCommand, RuntimeEventHandler, RuntimePort, RuntimeResult, Unsubscribe } from '../../ports/index.js';

export type CodexRuntimeOptions = unknown;

export interface CodexRuntimeInput {
  options: CodexRuntimeOptions;
}

export function createCodexRuntime(input: CodexRuntimeInput): RuntimePort {
  void input.options;
  const transport = createCodexTransport();

  return {
    send(command: RuntimeCommand): Promise<RuntimeResult> {
      return transport.send(command);
    },

    subscribe(handler: RuntimeEventHandler): Unsubscribe {
      return transport.subscribe(handler);
    },

    close(): Promise<void> {
      return transport.close();
    },
  };
}
