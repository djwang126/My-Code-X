import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createHttpApp } from './create-http-app.js';
import type { ApplicationService } from '../application/index.js';

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
    });

    const response = await app.handle({
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
    });

    assert.deepEqual(response, {
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
    });
  });

  test('rejects client actions that do not match the shared protocol', async () => {
    const app = createHttpApp({
      application: createApplication(),
    });

    const response = await app.handle({
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
    });

    assert.deepEqual(response, {
      statusCode: 400,
      message: 'Invalid client action',
    });
  });

  test('returns explicit health and not-found responses', async () => {
    const app = createHttpApp({
      application: createApplication(),
    });

    assert.deepEqual(await app.handle({
      method: 'GET',
      path: '/health',
      body: null,
    }), {
      status: 'ok',
    });

    assert.deepEqual(await app.handle({
      method: 'GET',
      path: '/missing',
      body: null,
    }), {
      statusCode: 404,
      message: 'Not found',
    });
  });

  test('rejects known routes with unsupported methods', async () => {
    const app = createHttpApp({
      application: createApplication(),
    });

    assert.deepEqual(await app.handle({
      method: 'GET',
      path: '/client',
      body: null,
    }), {
      statusCode: 405,
      message: 'Method not allowed',
    });

    assert.deepEqual(await app.handle({
      method: 'POST',
      path: '/health',
      body: null,
    }), {
      statusCode: 405,
      message: 'Method not allowed',
    });
  });
});
