import test from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../../../app/app.js';
import { withServer } from '../testing/chat-controller-test-helpers.js';

test('POST /api/v2/chat/message accepts structured content with attachment references', async () => {
  const calls = [];
  const app = createApp({
    authToken: 'session-auth',
    chatService: {
      async hydrateSession() {
        throw new Error('hydrateSession should not be called');
      },
      async sendMessage(payload) {
        calls.push(payload);
        return {
          threadId: 'thread-9',
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
    const response = await fetch(`http://127.0.0.1:${port}/api/v2/chat/message`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-auth',
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        viewerId: 'viewer-1',
        slotId: 'tab-1',
        workspace: 'D:/workspaces/My-Code-X',
        threadId: 'thread-9',
        content: [
          { type: 'text', text: '看看这两张图' },
          { type: 'imageAttachment', attachmentId: 'att-1' },
          { type: 'imageAttachment', attachmentId: 'att-2' },
        ],
      }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(calls, [
      {
        viewerId: 'viewer-1',
        slotId: 'tab-1',
        workspace: 'D:/workspaces/My-Code-X',
        threadId: 'thread-9',
        content: [
          { type: 'text', text: '看看这两张图' },
          { type: 'imageAttachment', attachmentId: 'att-1' },
          { type: 'imageAttachment', attachmentId: 'att-2' },
        ],
        runtimeSettings: undefined,
        collaborationModeKind: undefined,
      },
    ]);
  });
});

test('POST /api/v2/chat/message rejects more than 5 image attachments in one message', async () => {
  const app = createApp({
    authToken: 'session-auth',
    chatService: {
      async hydrateSession() {
        throw new Error('hydrateSession should not be called');
      },
      async sendMessage() {
        throw new Error('sendMessage should not be called');
      },
    },
  });

  await withServer(app, async ({ port }) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/v2/chat/message`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-auth',
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        viewerId: 'viewer-1',
        slotId: 'tab-1',
        workspace: 'D:/workspaces/My-Code-X',
        content: Array.from({ length: 6 }, (_, index) => ({
          type: 'imageAttachment',
          attachmentId: `att-${index + 1}`,
        })),
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.deepEqual(body, {
      error: {
        code: 'content_exceeds_attachment_limit',
        message: 'a message can contain at most 5 image attachments',
        status: 400,
      },
    });
  });
});

test('POST /api/v2/chat/message rejects imageAttachment items without a usable attachment id', async () => {
  const app = createApp({
    authToken: 'session-auth',
    chatService: {
      async hydrateSession() {
        throw new Error('hydrateSession should not be called');
      },
      async sendMessage() {
        throw new Error('sendMessage should not be called');
      },
    },
  });

  await withServer(app, async ({ port }) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/v2/chat/message`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer session-auth',
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        viewerId: 'viewer-1',
        slotId: 'tab-1',
        workspace: 'D:/workspaces/My-Code-X',
        content: [{ type: 'imageAttachment', attachmentId: '   ' }],
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.deepEqual(body, {
      error: {
        code: 'attachment_id_is_required',
        message: 'image attachments require a non-empty attachmentId',
        status: 400,
      },
    });
  });
});
