import test from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../../app/app.js';
import { withServer } from '../../common/testing/http-test-helpers.js';

test('POST /api/v2/app/restart acknowledges restart requests', async () => {
  const calls = [];
  const app = createApp({
    authToken: 'session-auth',
    restartHandler: async payload => {
      calls.push(payload);
      return { ok: true, restarting: true };
    },
  });

  await withServer(app, async ({ port }) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/v2/app/restart`, {
      method: 'POST',
      headers: { Authorization: 'Bearer session-auth', 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ viewerId: 'viewer-1', slotId: 'tab-1', workspace: 'D:/workspaces/My-Code-X', threadId: 'thread-9' }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(calls, [{ viewerId: 'viewer-1', slotId: 'tab-1', workspace: 'D:/workspaces/My-Code-X', threadId: 'thread-9' }]);
    assert.deepEqual(body, { ok: true, restarting: true });
  });
});

test('POST /api/v2/app/restart/shutdown acknowledges valid restart shutdown requests', async () => {
  const calls = [];
  const app = createApp({
    authToken: 'session-auth',
    restartShutdownHandler: async ({ token }) => {
      calls.push(token);
      return { ok: true, shuttingDown: true };
    },
  });

  await withServer(app, async ({ port }) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/v2/app/restart/shutdown`, {
      method: 'POST',
      headers: { Authorization: 'Bearer session-auth', 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ token: 'restart-token' }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(calls, ['restart-token']);
    assert.deepEqual(body, { ok: true, shuttingDown: true });
  });
});

test('POST /api/v2/app/restart/shutdown preserves invalid-token failures', async () => {
  const app = createApp({
    authToken: 'session-auth',
    restartShutdownHandler: async () => {
      const error = new Error('invalid restart token') as Error & { statusCode: number };
      error.statusCode = 403;
      throw error;
    },
  });

  await withServer(app, async ({ port }) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/v2/app/restart/shutdown`, {
      method: 'POST',
      headers: { Authorization: 'Bearer session-auth', 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ token: 'bad-token' }),
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.deepEqual(body, {
      error: {
        code: 'invalid_restart_token',
        message: 'invalid restart token',
        status: 403,
      },
    });
  });
});
