import { decodeCodexMessageToRuntimeEvent } from '../codec/event/decode-codex-message.js';
import { encodeRuntimeCommandToCodexRequest } from '../codec/command/encode-runtime-command.js';
import { decodeCodexResultToRuntimeResult } from '../codec/result/decode-codex-result.js';
import { encodeRuntimeHostResponseToCodexResult } from '../codec/response/encode-runtime-host-response.js';
import { CodexTransportClosedError } from '../errors/codex-runtime-error.js';
import type { CodexRuntimeLogger } from '../diagnostics/codex-runtime-logger.js';
import type { CodexJsonlTransport } from '../transport/create-jsonl-transport.js';
import type {
  RuntimeCommand,
  RuntimeEvent,
  RuntimeEventHandler,
  RuntimePort,
  RuntimeResult,
  Unsubscribe,
} from '../../../ports/index.js';
import type { JsonValue } from '@my-code-x/contracts-new/json';

export interface CreateCodexRuntimeGatewayInput {
  readonly transport: CodexJsonlTransport;
  readonly dynamicTools: readonly JsonValue[];
  readonly logger: CodexRuntimeLogger;
}

export function createCodexRuntimeGateway(input: CreateCodexRuntimeGatewayInput): RuntimePort {
  const runtimeEventHandlers = new Set<RuntimeEventHandler>();
  let closed = false;
  const unsubscribeTransport = input.transport.subscribe(message => {
    try {
      const event = decodeCodexMessageToRuntimeEvent({
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

    if (command.kind === 'respond-to-runtime-host-request') {
      await input.transport.respondToServerRequest({
        requestId: command.requestId,
        result: encodeRuntimeHostResponseToCodexResult({
          response: command.response,
        }),
      });

      return {
        kind: 'runtime-host-request-responded',
        requestId: command.requestId,
      };
    }

    const request = encodeRuntimeCommandToCodexRequest(command, {
      dynamicTools: input.dynamicTools,
    });
    const result = await input.transport.request(request);

    return decodeCodexResultToRuntimeResult({ command, result });
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
