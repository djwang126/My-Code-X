import { mapCodexIncomingMessageToRuntimeEvent } from '../protocol/map-runtime-event.js';
import { mapRuntimeCommandToCodexRequest } from '../protocol/map-runtime-command.js';
import { mapCodexResultToRuntimeResult } from '../protocol/map-runtime-result.js';
import { CodexTransportClosedError } from './codex-runtime-error.js';
import type { CodexRuntimeLogger } from './codex-runtime-logger.js';
import type { CodexJsonlTransport } from '../transport/create-jsonl-transport.js';
import type {
  RuntimeCommand,
  RuntimeEvent,
  RuntimeEventHandler,
  RuntimePort,
  RuntimeResult,
  Unsubscribe,
} from '../../../ports/index.js';
import type { JsonValue } from '../../../shared/index.js';

export interface CreateCodexRuntimeClientInput {
  readonly transport: CodexJsonlTransport;
  readonly dynamicTools: readonly JsonValue[];
  readonly logger: CodexRuntimeLogger;
}

export function createCodexRuntimeClient(input: CreateCodexRuntimeClientInput): RuntimePort {
  const runtimeEventHandlers = new Set<RuntimeEventHandler>();
  let closed = false;
  const unsubscribeTransport = input.transport.subscribe(message => {
    try {
      const event = mapCodexIncomingMessageToRuntimeEvent({
        message,
        logger: input.logger,
      });

      if (!event) {
        return;
      }

      emitRuntimeEvent(event);
    } catch (error) {
      emitRuntimeEvent({
        kind: 'runtime-error',
        threadId: null,
        turnId: null,
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: error instanceof Error ? error.name : null,
        },
      });
    }
  });

  function emitRuntimeEvent(event: RuntimeEvent) {
    for (const handler of runtimeEventHandlers) {
      handler(event);
    }
  }

  async function send(command: RuntimeCommand): Promise<RuntimeResult> {
    if (closed) {
      throw new CodexTransportClosedError();
    }

    if (command.kind === 'respond-to-runtime-request') {
      await input.transport.respondToServerRequest({
        requestId: command.requestId,
        result: command.response,
      });

      return {
        kind: 'runtime-request-responded',
        requestId: command.requestId,
      };
    }

    const request = mapRuntimeCommandToCodexRequest(command, {
      dynamicTools: input.dynamicTools,
    });
    const result = await input.transport.request(request);

    return mapCodexResultToRuntimeResult({ command, result });
  }

  return {
    send,

    subscribe(handler: RuntimeEventHandler): Unsubscribe {
      runtimeEventHandlers.add(handler);
      return () => {
        runtimeEventHandlers.delete(handler);
      };
    },

    async close(): Promise<void> {
      if (closed) {
        return;
      }

      closed = true;
      unsubscribeTransport();
      runtimeEventHandlers.clear();
      await input.transport.close();
    },
  };
}
