import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { RuntimeEvent, RuntimeResult } from '../../../ports/index.js';
import type { JsonValue } from '@my-code-x/contracts-new/json';
import type { CodexRuntimeLogger } from './codex-runtime-logger.js';
import { CodexProtocolError, CodexRpcError, CodexTransportClosedError } from './codex-runtime-error.js';
import { createCodexRuntimeClient } from './create-codex-runtime-client.js';
import type {
  CodexJsonlTransport,
  CodexServerRequestResponse,
  CodexTransportNotification,
  CodexTransportNotificationHandler,
  CodexTransportRequest,
} from '../transport/create-jsonl-transport.js';
import type { CodexIncomingMessage } from '../transport/jsonl-message.js';

interface TestTransport {
  readonly transport: CodexJsonlTransport;
  readonly requests: readonly CodexTransportRequest[];
  readonly serverResponses: readonly CodexServerRequestResponse[];
  readonly notifications: readonly CodexTransportNotification[];
  emit(message: CodexIncomingMessage): void;
  isClosed(): boolean;
  closeCount(): number;
}

function createTestLogger(): CodexRuntimeLogger {
  return {
    warn(_message: string): void {},
  };
}

function createTestTransport(results: readonly (JsonValue | Error)[] = []): TestTransport {
  const requests: CodexTransportRequest[] = [];
  const serverResponses: CodexServerRequestResponse[] = [];
  const notifications: CodexTransportNotification[] = [];
  const handlers = new Set<CodexTransportNotificationHandler>();
  const queuedResults = [...results];
  let closed = false;
  let closeCount = 0;

  return {
    requests,
    serverResponses,
    notifications,
    transport: {
      async request(input: CodexTransportRequest): Promise<JsonValue> {
        requests.push(input);
        const result = queuedResults.shift() ?? null;

        if (result instanceof Error) {
          throw result;
        }

        return result;
      },

      async notify(input: CodexTransportNotification): Promise<void> {
        notifications.push(input);
      },

      async respondToServerRequest(input: CodexServerRequestResponse): Promise<void> {
        serverResponses.push(input);
      },

      subscribe(handler: CodexTransportNotificationHandler): () => void {
        handlers.add(handler);
        return () => {
          handlers.delete(handler);
        };
      },

      async close(): Promise<void> {
        closed = true;
        closeCount += 1;
        handlers.clear();
      },
    },

    emit(message: CodexIncomingMessage): void {
      for (const handler of handlers) {
        handler(message);
      }
    },

    isClosed(): boolean {
      return closed;
    },

    closeCount(): number {
      return closeCount;
    },
  };
}

describe('createCodexRuntimeClient', () => {
  test('sends runtime commands through the Codex transport and maps the result', async () => {
    const testTransport = createTestTransport([
      {
        turn: {
          id: 'turn-1',
        },
      },
    ]);
    const client = createCodexRuntimeClient({
      transport: testTransport.transport,
      dynamicTools: [],
      logger: createTestLogger(),
    });

    const result = await client.send({
      kind: 'start-turn',
      threadId: 'thread-1',
      message: 'Hello',
      content: [],
      runtimeSettings: null,
    });

    assert.deepEqual(result, {
      kind: 'turn-started',
      turnId: 'turn-1',
    } satisfies RuntimeResult);
    assert.deepEqual(testTransport.requests, [
      {
        method: 'turn/start',
        params: {
          threadId: 'thread-1',
          input: [
            {
              type: 'text',
              text: 'Hello',
              text_elements: [],
            },
          ],
        },
      },
    ]);
  });

  test('responds to runtime input requests without sending a new Codex RPC request', async () => {
    const testTransport = createTestTransport();
    const client = createCodexRuntimeClient({
      transport: testTransport.transport,
      dynamicTools: [],
      logger: createTestLogger(),
    });

    const result = await client.send({
      kind: 'respond-to-runtime-request',
      requestId: 'request-1',
      response: {
        kind: 'raw',
        value: {
          approved: true,
        },
      },
    });

    assert.deepEqual(result, {
      kind: 'runtime-request-responded',
      requestId: 'request-1',
    });
    assert.deepEqual(testTransport.requests, []);
    assert.deepEqual(testTransport.serverResponses, [
      {
        requestId: 'request-1',
        result: {
          approved: true,
        },
      },
    ]);
  });

  test('maps typed runtime input responses to Codex server response payloads', async () => {
    const testTransport = createTestTransport();
    const client = createCodexRuntimeClient({
      transport: testTransport.transport,
      dynamicTools: [],
      logger: createTestLogger(),
    });

    await client.send({
      kind: 'respond-to-runtime-request',
      requestId: 'approval-1',
      method: 'item/commandExecution/requestApproval',
      response: {
        kind: 'decision',
        decision: 'accept',
      },
    });
    await client.send({
      kind: 'respond-to-runtime-request',
      requestId: 'tool-1',
      method: 'item/tool/call',
      response: {
        kind: 'dynamic-tool',
        contentItems: [{ type: 'inputText', text: 'ok' }],
        success: true,
      },
    });
    await client.send({
      kind: 'respond-to-runtime-request',
      requestId: 'auth-1',
      method: 'account/chatgptAuthTokens/refresh',
      response: {
        kind: 'auth-refresh',
        accessToken: 'access-token',
        chatgptAccountId: 'org-123',
        chatgptPlanType: 'business',
      },
    });

    assert.deepEqual(testTransport.serverResponses, [
      {
        requestId: 'approval-1',
        result: {
          decision: 'accept',
        },
      },
      {
        requestId: 'tool-1',
        result: {
          contentItems: [{ type: 'inputText', text: 'ok' }],
          success: true,
        },
      },
      {
        requestId: 'auth-1',
        result: {
          accessToken: 'access-token',
          chatgptAccountId: 'org-123',
          chatgptPlanType: 'business',
        },
      },
    ]);
  });

  test('rejects typed runtime input responses that do not match the Codex server request method', async () => {
    const testTransport = createTestTransport();
    const client = createCodexRuntimeClient({
      transport: testTransport.transport,
      dynamicTools: [],
      logger: createTestLogger(),
    });

    await assert.rejects(
      () =>
        client.send({
          kind: 'respond-to-runtime-request',
          requestId: 'request-1',
          method: 'item/tool/call',
          response: {
            kind: 'decision',
            decision: 'accept',
          },
        }),
      (error: unknown) =>
        error instanceof CodexProtocolError &&
        error.message === 'Codex server request item/tool/call requires a dynamic-tool response',
    );
    await assert.rejects(
      () =>
        client.send({
          kind: 'respond-to-runtime-request',
          requestId: 'request-2',
          method: 'account/chatgptAuthTokens/refresh',
          response: {
            kind: 'decision',
            decision: 'accept',
          },
        }),
      (error: unknown) =>
        error instanceof CodexProtocolError &&
        error.message === 'Codex server request account/chatgptAuthTokens/refresh requires a auth-refresh response',
    );
    assert.deepEqual(testTransport.serverResponses, []);
  });

  test('publishes mapped runtime events to subscribers until they unsubscribe', () => {
    const testTransport = createTestTransport();
    const client = createCodexRuntimeClient({
      transport: testTransport.transport,
      dynamicTools: [],
      logger: createTestLogger(),
    });
    const events: RuntimeEvent[] = [];
    const unsubscribe = client.subscribe(event => {
      events.push(event);
    });

    testTransport.emit({
      kind: 'notification',
      method: 'turn/started',
      params: {
        threadId: 'thread-1',
        turnId: 'turn-1',
      },
    });
    unsubscribe();
    testTransport.emit({
      kind: 'notification',
      method: 'turn/started',
      params: {
        threadId: 'thread-2',
        turnId: 'turn-2',
      },
    });

    assert.deepEqual(events, [
      {
        kind: 'runtime-turn-started',
        threadId: 'thread-1',
        turnId: 'turn-1',
      },
    ]);
  });

  test('isolates runtime event subscriptions when one subscriber unsubscribes', () => {
    const testTransport = createTestTransport();
    const client = createCodexRuntimeClient({
      transport: testTransport.transport,
      dynamicTools: [],
      logger: createTestLogger(),
    });
    const firstSubscriberEvents: RuntimeEvent[] = [];
    const secondSubscriberEvents: RuntimeEvent[] = [];
    const unsubscribeFirst = client.subscribe(event => {
      firstSubscriberEvents.push(event);
    });
    client.subscribe(event => {
      secondSubscriberEvents.push(event);
    });

    testTransport.emit({
      kind: 'notification',
      method: 'turn/started',
      params: {
        threadId: 'thread-1',
        turnId: 'turn-1',
      },
    });
    unsubscribeFirst();
    testTransport.emit({
      kind: 'notification',
      method: 'turn/started',
      params: {
        threadId: 'thread-2',
        turnId: 'turn-2',
      },
    });

    assert.deepEqual(firstSubscriberEvents, [
      {
        kind: 'runtime-turn-started',
        threadId: 'thread-1',
        turnId: 'turn-1',
      },
    ]);
    assert.deepEqual(secondSubscriberEvents, [
      {
        kind: 'runtime-turn-started',
        threadId: 'thread-1',
        turnId: 'turn-1',
      },
      {
        kind: 'runtime-turn-started',
        threadId: 'thread-2',
        turnId: 'turn-2',
      },
    ]);
  });

  test('preserves typed transport errors from runtime command sends', async () => {
    const testTransport = createTestTransport([new CodexRpcError('turn/start', 500, 'turn failed')]);
    const client = createCodexRuntimeClient({
      transport: testTransport.transport,
      dynamicTools: [],
      logger: createTestLogger(),
    });

    await assert.rejects(
      () =>
        client.send({
          kind: 'start-turn',
          threadId: 'thread-1',
          message: 'Hello',
          content: [],
          runtimeSettings: null,
        }),
      (error: unknown) =>
        error instanceof CodexRpcError &&
        error.method === 'turn/start' &&
        error.code === 500 &&
        error.message === 'turn failed',
    );
  });

  test('turns malformed Codex notifications into runtime-error events', () => {
    const testTransport = createTestTransport();
    const client = createCodexRuntimeClient({
      transport: testTransport.transport,
      dynamicTools: [],
      logger: createTestLogger(),
    });
    const events: RuntimeEvent[] = [];
    client.subscribe(event => {
      events.push(event);
    });

    testTransport.emit({
      kind: 'notification',
      method: 'turn/started',
      params: {
        turnId: 'turn-1',
      },
    });

    assert.deepEqual(events, [
      {
        kind: 'runtime-error',
        threadId: null,
        turnId: null,
        error: {
          message: 'Codex turn/started threadId must be a string',
          code: 'CodexProtocolError',
        },
      },
    ]);
  });

  test('close is idempotent, unsubscribes from transport events, and rejects later sends', async () => {
    const testTransport = createTestTransport();
    const client = createCodexRuntimeClient({
      transport: testTransport.transport,
      dynamicTools: [],
      logger: createTestLogger(),
    });
    const events: RuntimeEvent[] = [];
    client.subscribe(event => {
      events.push(event);
    });

    await client.close();
    await client.close();
    testTransport.emit({
      kind: 'notification',
      method: 'turn/started',
      params: {
        threadId: 'thread-1',
        turnId: 'turn-1',
      },
    });

    assert.deepEqual(events, []);
    assert.equal(testTransport.isClosed(), true);
    assert.equal(testTransport.closeCount(), 1);
    await assert.rejects(
      () =>
        client.send({
          kind: 'start-turn',
          threadId: 'thread-1',
          message: 'Hello after close',
          content: [],
          runtimeSettings: null,
        }),
      (error: unknown) => error instanceof CodexTransportClosedError && error.message === 'Codex transport is closed',
    );
  });
});
