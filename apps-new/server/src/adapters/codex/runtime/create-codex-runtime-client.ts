import { mapCodexIncomingMessageToRuntimeEvent } from '../protocol/map-runtime-event.js';
import { mapRuntimeCommandToCodexRequest } from '../protocol/map-runtime-command.js';
import { mapCodexResultToRuntimeResult } from '../protocol/map-runtime-result.js';
import { CodexProtocolError, CodexTransportClosedError } from './codex-runtime-error.js';
import type { CodexRuntimeLogger } from './codex-runtime-logger.js';
import type { CodexJsonlTransport } from '../transport/create-jsonl-transport.js';
import type {
  RuntimeCommand,
  RuntimeEvent,
  RuntimeEventHandler,
  RuntimeRequestResponse,
  RuntimePort,
  RuntimeResult,
  Unsubscribe,
} from '../../../ports/index.js';
import type { JsonObject, JsonValue } from '@my-code-x/contracts-new/json';

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
        result: mapRuntimeRequestResponseToCodexResult({
          method: command.method,
          response: command.response,
        }),
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

interface MapRuntimeRequestResponseInput {
  readonly method: string | undefined;
  readonly response: RuntimeRequestResponse;
}

function mapRuntimeRequestResponseToCodexResult(input: MapRuntimeRequestResponseInput): JsonValue {
  assertRuntimeRequestResponseMatchesMethod(input);

  switch (input.response.kind) {
    case 'raw':
      return input.response.value;

    case 'decision':
      return {
        decision: input.response.decision,
      };

    case 'permissions':
      return cleanJsonObject({
        permissions: input.response.permissions,
        scope: input.response.scope,
        strictAutoReview: input.response.strictAutoReview ?? undefined,
      });

    case 'mcp-elicitation':
      return cleanJsonObject({
        action: input.response.action,
        content: input.response.content,
        _meta: input.response.meta,
      });

    case 'dynamic-tool':
      return {
        contentItems: [...input.response.contentItems],
        success: input.response.success,
      };

    case 'user-input':
      return {
        answers: input.response.answers,
      };

    case 'auth-refresh':
      return cleanJsonObject({
        accessToken: input.response.accessToken,
        chatgptAccountId: input.response.chatgptAccountId,
        chatgptPlanType: input.response.chatgptPlanType,
      });
  }
}

function assertRuntimeRequestResponseMatchesMethod(input: MapRuntimeRequestResponseInput): void {
  if (!input.method || input.response.kind === 'raw') {
    return;
  }

  const expectedKind = runtimeRequestResponseKindForMethod(input.method);
  if (!expectedKind) {
    return;
  }

  if (input.response.kind !== expectedKind) {
    throw new CodexProtocolError(`Codex server request ${input.method} requires a ${expectedKind} response`);
  }
}

function runtimeRequestResponseKindForMethod(method: string): RuntimeRequestResponse['kind'] | null {
  switch (method) {
    case 'item/commandExecution/requestApproval':
    case 'item/fileChange/requestApproval':
    case 'applyPatchApproval':
    case 'execCommandApproval':
      return 'decision';
    case 'item/permissions/requestApproval':
      return 'permissions';
    case 'mcpServer/elicitation/request':
      return 'mcp-elicitation';
    case 'item/tool/call':
      return 'dynamic-tool';
    case 'item/tool/requestUserInput':
      return 'user-input';
    case 'account/chatgptAuthTokens/refresh':
      return 'auth-refresh';
    default:
      return null;
  }
}

function cleanJsonObject(input: Record<string, JsonValue | undefined>): JsonObject {
  const output: Record<string, JsonValue> = {};

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) {
      continue;
    }

    output[key] = value;
  }

  return output;
}
