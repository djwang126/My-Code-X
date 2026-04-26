import type { RuntimeCommand, RuntimeEventHandler, RuntimeResult, Unsubscribe } from '../../ports/index.js';

export interface CodexTransport {
  send(input: RuntimeCommand): Promise<RuntimeResult>;
  subscribe(handler: RuntimeEventHandler): Unsubscribe;
  close(): Promise<void>;
}

export function createCodexTransport(): CodexTransport {
  const handlers = new Set<RuntimeEventHandler>();

  return {
    async send(input: RuntimeCommand): Promise<RuntimeResult> {
      return input;
    },

    subscribe(handler: RuntimeEventHandler): Unsubscribe {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },

    async close() {
      handlers.clear();
    },
  };
}