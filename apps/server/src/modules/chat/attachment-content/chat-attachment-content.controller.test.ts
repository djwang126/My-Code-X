import test from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../../../app/app.js';
import { withServer } from '../testing/chat-controller-test-helpers.js';

test('GET /api/v2/chat/attachments/:attachmentId/content serves persisted image bytes for the active thread context', async () => {
  const calls = [];
  const app = createApp({
    authToken: 'session-auth',
    chatService: {
      async getAttachmentContent({ attachmentId, slotId, threadId }) {
        calls.push({ attachmentId, slotId, threadId });
        return {
          contentType: 'image/webp',
          body: Buffer.from('RIFF-test-image', 'utf8'),
        };
      },
    },
  });

  await withServer(app, async ({ port }) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/v2/chat/attachments/att-1/content?slotId=tab-1&threadId=thread-9`, {
      headers: {
        Authorization: 'Bearer session-auth',
      },
    });
    const body = Buffer.from(await response.arrayBuffer());

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/webp');
    assert.deepEqual(calls, [{ attachmentId: 'att-1', slotId: 'tab-1', threadId: 'thread-9' }]);
    assert.equal(body.toString('utf8'), 'RIFF-test-image');
  });
});

test('GET /api/v2/chat/attachments/:attachmentId/content returns a controlled 404 for expired or missing attachments', async () => {
  const app = createApp({
    authToken: 'session-auth',
    chatService: {
      async getAttachmentContent() {
        const error = new Error('attachment_not_found') as Error & { statusCode: number; code: string };
        error.statusCode = 404;
        error.code = 'attachment_not_found';
        throw error;
      },
    },
  });

  await withServer(app, async ({ port }) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/v2/chat/attachments/att-missing/content?slotId=tab-1&threadId=thread-9`, {
      headers: {
        Authorization: 'Bearer session-auth',
      },
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.deepEqual(body, {
      error: {
        code: 'attachment_not_found',
        message: 'attachment_not_found',
        status: 404,
      },
    });
  });
});

test('GET /api/v2/chat/attachments/:attachmentId/content rejects unauthorized requests before any attachment lookup', async () => {
  const app = createApp({
    authToken: 'session-auth',
    chatService: {
      async getAttachmentContent() {
        throw new Error('getAttachmentContent should not be called');
      },
    },
  });

  await withServer(app, async ({ port }) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/v2/chat/attachments/att-1/content`);
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.deepEqual(body, {
      error: {
        code: 'unauthorized',
        message: 'unauthorized',
        status: 401,
      },
      authRequired: true,
    });
  });
});

test('GET /api/v2/chat/attachments/:attachmentId/content returns 400 when thread context is missing', async () => {
  const app = createApp({
    authToken: 'session-auth',
    chatService: {
      async getAttachmentContent() {
        throw new Error('getAttachmentContent should not be called');
      },
    },
  });

  await withServer(app, async ({ port }) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/v2/chat/attachments/att-1/content?slotId=tab-1`, {
      headers: {
        Authorization: 'Bearer session-auth',
      },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.deepEqual(body, {
      error: {
        code: 'threadid_is_required',
        message: 'threadId is required',
        status: 400,
      },
    });
  });
});
