import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createHttpApp } from './create-http-app.js';
import type { ApplicationService, SubscribeClientEventStreamInput } from '../application/index.js';
import type { HttpEventStreamResponse, HttpRequest, HttpResponse } from './http-types.js';

const noopApplication: ApplicationService = {
  async openClient() {
    throw new Error('openClient is outside this test');
  },

  async sendClientMessage() {
    throw new Error('sendClientMessage is outside this test');
  },

  async resumeClientThread() {
    throw new Error('resumeClientThread is outside this test');
  },

  async respondClientInteraction() {
    throw new Error('respondClientInteraction is outside this test');
  },

  async interruptClientTurn() {
    throw new Error('interruptClientTurn is outside this test');
  },
};

describe('client event HTTP stream', () => {
  test('exposes client conversation events as an SSE response', async () => {
    const eventStream = createCapturingEventStream();
    const app = createHttpApp({
      application: noopApplication,
      eventStream,
    });

    const response = assertEventStreamResponse(await app.handle(createTestRequest({
      method: 'GET',
      path: '/client/events',
      query: {
        slotId: 'slot-1',
        threadId: 'thread-1',
      },
      body: null,
    })));
    const chunks: string[] = [];

    const close = response.open({
      write(data) {
        chunks.push(data);
      },
    });
    const subscription = readOnlySubscription({ subscriptions: eventStream.subscriptions });

    subscription.send({
      kind: 'conversation-item-upserted',
      scope: {
        slotId: 'slot-1',
        threadId: 'thread-1',
      },
      revision: '1',
      item: {
        id: 'assistant-1',
        kind: 'message',
        role: 'assistant',
        text: 'hello',
      },
    });
    close();

    assert.deepEqual(chunks, [
      'data: {"kind":"conversation-item-upserted","scope":{"slotId":"slot-1","threadId":"thread-1"},"revision":"1","item":{"id":"assistant-1","kind":"message","role":"assistant","text":"hello"}}\n\n',
    ]);
  });

  test('closes the event stream subscription and ignores late writes', async () => {
    const eventStream = createCapturingEventStream();
    const app = createHttpApp({
      application: noopApplication,
      eventStream,
    });
    const response = assertEventStreamResponse(await app.handle(createTestRequest({
      method: 'GET',
      path: '/client/events',
      query: {
        slotId: 'slot-1',
        threadId: 'thread-1',
      },
      body: null,
    })));
    const chunks: string[] = [];

    const close = response.open({
      write(data) {
        chunks.push(data);
      },
    });
    const subscription = readOnlySubscription({ subscriptions: eventStream.subscriptions });

    close();
    subscription.send({
      kind: 'conversation-item-upserted',
      scope: {
        slotId: 'slot-1',
        threadId: 'thread-1',
      },
      revision: '1',
      item: {
        id: 'assistant-1',
        kind: 'message',
        role: 'assistant',
        text: 'late event',
      },
    });

    assert.equal(eventStream.unsubscribeCount, 1);
    assert.deepEqual(chunks, []);
  });

  test('rejects duplicate client event scope query values', async () => {
    const app = createHttpApp({
      application: noopApplication,
      eventStream: createCapturingEventStream(),
    });

    assert.deepEqual(await app.handle(createTestRequest({
      method: 'GET',
      path: '/client/events',
      query: {
        slotId: ['slot-1', 'slot-2'],
        threadId: 'thread-1',
      },
      body: null,
    })), {
      kind: 'json',
      statusCode: 400,
      headers: {},
      body: {
        error: {
          message: 'Invalid client event scope',
        },
      },
    });
  });
});

interface CapturingEventStream {
  readonly subscriptions: readonly SubscribeClientEventStreamInput[];
  readonly unsubscribeCount: number;
  subscribe(input: SubscribeClientEventStreamInput): () => void;
}

function createCapturingEventStream(): CapturingEventStream {
  const subscriptions: SubscribeClientEventStreamInput[] = [];
  let unsubscribeCount = 0;

  return {
    get subscriptions() {
      return subscriptions;
    },

    get unsubscribeCount() {
      return unsubscribeCount;
    },

    subscribe(input) {
      subscriptions.push(input);
      return () => {
        unsubscribeCount += 1;
      };
    },
  };
}

function assertEventStreamResponse(response: HttpResponse): HttpEventStreamResponse {
  assert.equal(response.kind, 'event-stream');
  return response as HttpEventStreamResponse;
}

interface ReadOnlySubscriptionInput {
  readonly subscriptions: readonly SubscribeClientEventStreamInput[];
}

function readOnlySubscription(input: ReadOnlySubscriptionInput): SubscribeClientEventStreamInput {
  assert.equal(input.subscriptions.length, 1);
  return input.subscriptions[0] as SubscribeClientEventStreamInput;
}

interface CreateTestRequestInput {
  readonly method: HttpRequest['method'];
  readonly path: string;
  readonly query: HttpRequest['query'];
  readonly body: HttpRequest['body'];
}

function createTestRequest(input: CreateTestRequestInput): HttpRequest {
  return {
    method: input.method,
    path: input.path,
    query: input.query,
    headers: {},
    body: input.body,
    rawBody: null,
    signal: new globalThis.AbortController().signal,
  };
}


