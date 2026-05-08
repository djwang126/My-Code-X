import test from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../../../app/app.js';
import { withServer } from '../testing/chat-controller-test-helpers.js';

test('GET /api/v2/thread/history returns workspace-scoped thread history', async () => {
  const app = createApp({
    authToken: 'session-auth',
    chatService: {
      async listThreadHistory({ workspace, limit }) {
        assert.equal(workspace, 'D:/workspaces/My-Code-X');
        assert.equal(limit, 10);
        return [{ id: 'thread-1' }];
      },
    },
  });

  await withServer(app, async ({ port }) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/v2/thread/history?workspace=D%3A%2Fworkspaces%2FMy-Code-X&limit=10`, {
      headers: { Authorization: 'Bearer session-auth' },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, { data: [{ id: 'thread-1' }] });
  });
});

test('GET /api/v2/thread/history preserves the raw runtime error text', async () => {
  const app = createApp({
    authToken: 'session-auth',
    chatService: {
      async listThreadHistory() {
        throw new Error('history unavailable');
      },
    },
  });

  await withServer(app, async ({ port }) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/v2/thread/history?workspace=D%3A%2Fworkspaces%2FMy-Code-X`, {
      headers: { Authorization: 'Bearer session-auth' },
    });
    const body = await response.json();

    assert.equal(response.status, 502);
    assert.deepEqual(body, {
      error: {
        code: 'history_unavailable',
        message: 'history unavailable',
        status: 502,
      },
    });
  });
});
