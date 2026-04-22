import test from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../../../app/app.js';
import { withServer } from '../testing/chat-controller-test-helpers.js';

test('POST /api/v2/server-requests/respond forwards the response payload to the runtime service', async () => {
  const calls = [];
  const app = createApp({
    authToken: 'session-auth',
    chatService: {
      async respondToPendingRequest(payload) {
        calls.push(payload);
        return { ok: true };
      },
    },
  });

  await withServer(app, async ({ port }) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/v2/server-requests/respond`, {
      method: 'POST',
      headers: { Authorization: 'Bearer session-auth', 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ slotId: 'tab-1', threadId: 'thread-9', requestId: 'req-1', response: { approved: true } }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(calls, [{ slotId: 'tab-1', threadId: 'thread-9', requestId: 'req-1', response: { approved: true } }]);
    assert.deepEqual(body, { ok: true });
  });
});

test('POST /api/v2/server-requests/respond allows threadless request responses', async () => {
  const calls = [];
  const app = createApp({
    authToken: 'session-auth',
    chatService: {
      async respondToPendingRequest(payload) {
        calls.push(payload);
        return { ok: true };
      },
    },
  });

  await withServer(app, async ({ port }) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/v2/server-requests/respond`, {
      method: 'POST',
      headers: { Authorization: 'Bearer session-auth', 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ slotId: 'tab-1', requestId: 'req-1', response: { approved: true } }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(calls, [{ slotId: 'tab-1', threadId: '', requestId: 'req-1', response: { approved: true } }]);
  });
});

test('POST /api/v2/server-requests/respond validates the required fields', async () => {
  const app = createApp({
    authToken: 'session-auth',
    chatService: {
      async respondToPendingRequest() {
        throw new Error('should not be called');
      },
    },
  });

  await withServer(app, async ({ port }) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/v2/server-requests/respond`, {
      method: 'POST',
      headers: { Authorization: 'Bearer session-auth', 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ slotId: 'tab-1' }),
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.deepEqual(body, { error: { code: 'requestid_is_required', message: 'requestId is required', status: 400 } });
  });
});

test('POST /api/v2/server-requests/respond preserves raw runtime errors', async () => {
  const app = createApp({
    authToken: 'session-auth',
    chatService: {
      async respondToPendingRequest() {
        const error = new Error('request not found') as Error & { statusCode: number };
        error.statusCode = 409;
        throw error;
      },
    },
  });

  await withServer(app, async ({ port }) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/v2/server-requests/respond`, {
      method: 'POST',
      headers: { Authorization: 'Bearer session-auth', 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ slotId: 'tab-1', requestId: 'req-1', response: {} }),
    });
    const body = await response.json();

    assert.equal(response.status, 409);
    assert.deepEqual(body, {
      error: {
        code: 'request_not_found',
        message: 'request not found',
        status: 409,
      },
    });
  });
});
