import test from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../../../app/app.js';
import { withServer } from '../testing/chat-controller-test-helpers.js';

test('POST /api/v2/chat/interrupt interrupts the active turn for the current slot thread', async () => {
  const calls = [];
  const app = createApp({
    authToken: 'session-auth',
    chatService: {
      async interruptTurn({ slotId, threadId }) {
        calls.push({ slotId, threadId });
        return {
          ok: true,
          threadId,
          latestTurn: {
        id: 'turn-9',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
        };
      },
    },
  });

  await withServer(app, async ({ port }) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/v2/chat/interrupt`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-auth',
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({ slotId: 'tab-1', threadId: 'thread-9' }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(calls, [{ slotId: 'tab-1', threadId: 'thread-9' }]);
    assert.deepEqual(body, {
      ok: true,
      threadId: 'thread-9',
      latestTurn: {
        id: 'turn-9',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
    });
  });
});
