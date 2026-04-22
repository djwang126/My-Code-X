import test from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../../../app/app.js';
import { withServer } from '../testing/chat-controller-test-helpers.js';

test('GET /api/v2/chat/item-content returns the full timeline item details on demand', async () => {
  const calls = [];
  const app = createApp({
    authToken: 'session-auth',
    chatService: {
      async getTimelineItemContent({ slotId, threadId, itemId }) {
        calls.push({ slotId, threadId, itemId });
        return {
          itemId,
          itemType: 'commandExecution',
          detailRevision: 'rev-1',
          raw: {
            type: 'commandExecution',
            id: itemId,
            command: 'npm test',
            aggregatedOutput:
              'line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nline 8\nline 9\nline 10\nline 11\nline 12',
          },
        };
      },
    },
  });

  await withServer(app, async ({ port }) => {
    const response = await fetch(
      `http://127.0.0.1:${port}/api/v2/chat/item-content?slotId=tab-1&threadId=thread-9&itemId=cmd-1`,
      { headers: { Authorization: 'Bearer session-auth' } },
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(calls, [{ slotId: 'tab-1', threadId: 'thread-9', itemId: 'cmd-1' }]);
    assert.equal(body.itemId, 'cmd-1');
    assert.equal(body.itemType, 'commandExecution');
  });
});
