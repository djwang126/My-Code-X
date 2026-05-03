import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createHttpApp } from './create-http-app.js';
import type { ApplicationService } from '../application/index.js';
import type { HttpRequest } from './http-types.js';

function createApplication(): ApplicationService {
  return {
    async openClient(input) {
      return {
        app: {
          status: 'ready',
        },
        identity: {
          slotId: input.scope.slotId ?? 'slot-1',
        },
        selection: {
          workspaceId: input.scope.workspaceId,
          threadId: input.scope.threadId,
        },
        workspace: {
          status: 'none',
        },
        thread: {
          status: 'none',
          title: null,
        },
        turn: {
          current: null,
        },
        conversation: {
          status: 'ready',
          revision: 0,
          items: [],
        },
        pendingInteractions: [],
        notices: [],
        capabilities: {
          actions: [],
          options: {},
        },
        stream: {
          status: 'disabled',
          revision: 'initial',
        },
      };
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
}

describe('client HTTP conversation snapshot shell', () => {
  test('returns a ready empty conversation view for open-client action', async () => {
    const app = createHttpApp({
      application: createApplication(),
      eventStream: createNoopClientEventStream(),
    });

    const response = await app.handle({
      ...createTestRequest({
        method: 'POST',
        path: '/client',
        body: {
          kind: 'open-client',
          scope: {
            slotId: 'slot-1',
            workspaceId: null,
            threadId: null,
          },
          payload: {},
        },
      }),
    });

    assert.deepEqual(response, {
      kind: 'json',
      statusCode: 200,
      headers: {},
      body: {
        app: {
          status: 'ready',
        },
        identity: {
          slotId: 'slot-1',
        },
        selection: {
          workspaceId: null,
          threadId: null,
        },
        workspace: {
          status: 'none',
        },
        thread: {
          status: 'none',
          title: null,
        },
        turn: {
          current: null,
        },
        conversation: {
          status: 'ready',
          revision: 0,
          items: [],
        },
        pendingInteractions: [],
        notices: [],
        capabilities: {
          actions: [],
          options: {},
        },
        stream: {
          status: 'disabled',
          revision: 'initial',
        },
      },
    });
  });

  test('rejects client actions that do not match the shared protocol', async () => {
    const app = createHttpApp({
      application: createApplication(),
      eventStream: createNoopClientEventStream(),
    });

    const response = await app.handle(createTestRequest({
      method: 'POST',
      path: '/client',
      body: {
        kind: 'open-client',
        scope: {
          slotId: 'slot-1',
          workspaceId: null,
          threadId: null,
        },
      },
    }));

    assert.deepEqual(response, {
      kind: 'json',
      statusCode: 400,
      headers: {},
      body: {
        error: {
          message: 'Invalid client action',
        },
      },
    });
  });

  test('rejects client actions with unsupported content type', async () => {
    const app = createHttpApp({
      application: createApplication(),
      eventStream: createNoopClientEventStream(),
    });

    const response = await app.handle(createTestRequest({
      method: 'POST',
      path: '/client',
      headers: {
        'content-type': 'text/plain',
      },
      body: {
        kind: 'open-client',
        scope: {
          slotId: 'slot-1',
          workspaceId: null,
          threadId: null,
        },
        payload: {},
      },
    }));

    assert.deepEqual(response, {
      kind: 'json',
      statusCode: 415,
      headers: {},
      body: {
        error: {
          message: 'Unsupported media type',
        },
      },
    });
  });

  test('returns explicit health and not-found responses', async () => {
    const app = createHttpApp({
      application: createApplication(),
      eventStream: createNoopClientEventStream(),
    });

    assert.deepEqual(await app.handle(createTestRequest({
      method: 'GET',
      path: '/health',
      body: null,
    })), {
      kind: 'json',
      statusCode: 200,
      headers: {},
      body: {
        status: 'ok',
      },
    });

    assert.deepEqual(await app.handle(createTestRequest({
      method: 'GET',
      path: '/missing',
      body: null,
    })), {
      kind: 'json',
      statusCode: 404,
      headers: {},
      body: {
        error: {
          message: 'Not found',
        },
      },
    });
  });

  test('rejects known routes with unsupported methods', async () => {
    const app = createHttpApp({
      application: createApplication(),
      eventStream: createNoopClientEventStream(),
    });

    assert.deepEqual(await app.handle(createTestRequest({
      method: 'GET',
      path: '/client',
      body: null,
    })), {
      kind: 'json',
      statusCode: 405,
      headers: {},
      body: {
        error: {
          message: 'Method not allowed',
        },
      },
    });

    assert.deepEqual(await app.handle(createTestRequest({
      method: 'POST',
      path: '/health',
      body: null,
    })), {
      kind: 'json',
      statusCode: 405,
      headers: {},
      body: {
        error: {
          message: 'Method not allowed',
        },
      },
    });
  });
});

type TestRequestInput = Pick<HttpRequest, 'method' | 'path' | 'body'> & {
  readonly headers?: HttpRequest['headers'];
};

function createTestRequest(input: TestRequestInput): HttpRequest {
  return {
    method: input.method,
    path: input.path,
    query: {},
    headers: input.headers ?? {
      'content-type': 'application/json',
    },
    body: input.body,
    rawBody: input.body === null ? null : JSON.stringify(input.body),
    signal: new globalThis.AbortController().signal,
  };
}

function createNoopClientEventStream() {
  return {
    subscribe() {
      return () => {};
    },
  };
}
