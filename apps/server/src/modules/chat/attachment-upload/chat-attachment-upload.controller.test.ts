/* global Blob, FormData */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../../../app/app.js';
import { withServer } from '../testing/chat-controller-test-helpers.js';

function createMultipartForm(filename, type, content = 'fake-image', fields = { slotId: 'tab-1', threadId: 'thread-9' }) {
  const form = new FormData();
  form.append('file', new Blob([content], { type }), filename);
  Object.entries(fields).forEach(([key, value]) => form.append(key, value));
  return form;
}

test('POST /api/v2/chat/attachments stores a local image attachment and returns normalized metadata', async () => {
  const calls = [];
  const app = createApp({
    authToken: 'session-auth',
    chatService: {
      getSessionState({ slotId, threadId }) {
        assert.deepEqual({ slotId, threadId }, { slotId: 'tab-1', threadId: 'thread-9' });
        return {
          viewerId: 'viewer-1',
          threadId: 'thread-9',
        };
      },
      async uploadAttachment(input) {
        calls.push(input);
        return {
          attachmentId: 'att-1',
          contentType: 'image/webp',
          width: 1600,
          height: 900,
          byteLength: 456789,
        };
      },
    },
  });

  await withServer(app, async ({ port }) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/v2/chat/attachments`, {
      method: 'POST',
      headers: { Authorization: 'Bearer session-auth' },
      body: createMultipartForm('screen.png', 'image/png'),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(calls, [
      {
        filename: 'screen.png',
        contentType: 'image/png',
        buffer: Buffer.from('fake-image'),
        viewerId: 'viewer-1',
        threadId: 'thread-9',
      },
    ]);
    assert.deepEqual(body, {
      attachmentId: 'att-1',
      contentType: 'image/webp',
      width: 1600,
      height: 900,
      byteLength: 456789,
    });
  });
});

test('POST /api/v2/chat/attachments rejects unsupported files before persistence', async () => {
  const app = createApp({
    authToken: 'session-auth',
    chatService: {
      async uploadAttachment() {
        throw new Error('uploadAttachment should not be called');
      },
    },
  });

  await withServer(app, async ({ port }) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/v2/chat/attachments`, {
      method: 'POST',
      headers: { Authorization: 'Bearer session-auth' },
      body: createMultipartForm('notes.txt', 'text/plain', 'not-an-image'),
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.deepEqual(body, {
      error: {
        code: 'unsupported_attachment_type',
        message: 'only image attachments are supported',
        status: 400,
      },
    });
  });
});

test('POST /api/v2/chat/attachments returns a clear failure when compression cannot bring the file under the cap', async () => {
  const app = createApp({
    authToken: 'session-auth',
    chatService: {
      getSessionState() {
        return {
          viewerId: 'viewer-1',
          threadId: 'thread-9',
        };
      },
      async uploadAttachment() {
        const error = new Error('attachment_too_large_after_compression') as Error & {
          statusCode: number;
          code: string;
        };
        error.statusCode = 413;
        error.code = 'attachment_too_large_after_compression';
        throw error;
      },
    },
  });

  await withServer(app, async ({ port }) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/v2/chat/attachments`, {
      method: 'POST',
      headers: { Authorization: 'Bearer session-auth' },
      body: createMultipartForm('large.png', 'image/png', 'x'.repeat(1024)),
    });
    const body = await response.json();

    assert.equal(response.status, 413);
    assert.deepEqual(body, {
      error: {
        code: 'attachment_too_large_after_compression',
        message: 'attachment_too_large_after_compression',
        status: 413,
      },
    });
  });
});

test('POST /api/v2/chat/attachments rejects uploads that exceed the raw safety hard cap before compression', async () => {
  const app = createApp({
    authToken: 'session-auth',
    chatService: {
      getSessionState() {
        return {
          viewerId: 'viewer-1',
          threadId: 'thread-9',
        };
      },
      async uploadAttachment() {
        const error = new Error('attachment_upload_too_large') as Error & { statusCode: number; code: string };
        error.statusCode = 413;
        error.code = 'attachment_upload_too_large';
        throw error;
      },
    },
  });

  await withServer(app, async ({ port }) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/v2/chat/attachments`, {
      method: 'POST',
      headers: { Authorization: 'Bearer session-auth' },
      body: createMultipartForm('huge-camera-roll.jpg', 'image/jpeg', 'x'.repeat(1024)),
    });
    const body = await response.json();

    assert.equal(response.status, 413);
    assert.deepEqual(body, {
      error: {
        code: 'attachment_upload_too_large',
        message: 'attachment_upload_too_large',
        status: 413,
      },
    });
  });
});

test('POST /api/v2/chat/attachments rejects uploads when the active session context cannot be resolved', async () => {
  const app = createApp({
    authToken: 'session-auth',
    chatService: {
      getSessionState() {
        return null;
      },
      async uploadAttachment() {
        throw new Error('uploadAttachment should not be called');
      },
    },
  });

  await withServer(app, async ({ port }) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/v2/chat/attachments`, {
      method: 'POST',
      headers: { Authorization: 'Bearer session-auth' },
      body: createMultipartForm('screen.png', 'image/png'),
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.deepEqual(body, {
      error: {
        code: 'attachment_session_not_found',
        message: 'attachment_session_not_found',
        status: 404,
      },
    });
  });
});

test('POST /api/v2/chat/attachments rejects oversized multipart uploads before they reach the chat service', async () => {
  let uploadCalled = false;
  const app = createApp({
    authToken: 'session-auth',
    chatService: {
      async uploadAttachment() {
        uploadCalled = true;
        throw new Error('uploadAttachment should not be called');
      },
    },
  });

  await withServer(app, async ({ port }) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/v2/chat/attachments`, {
      method: 'POST',
      headers: { Authorization: 'Bearer session-auth' },
      body: createMultipartForm('too-big.jpg', 'image/jpeg', 'x'.repeat(10_000_001)),
    });
    const body = await response.json();

    assert.equal(response.status, 413);
    assert.equal(uploadCalled, false);
    assert.deepEqual(body, {
      error: {
        code: 'attachment_upload_too_large',
        message: 'attachment_upload_too_large',
        status: 413,
      },
    });
  });
});
