import test from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../../../app/app.js';
import { withServer } from '../testing/chat-controller-test-helpers.js';

test('POST /api/v2/thread/compact triggers compaction for the active thread', async () => {
  const calls = [];
  const app = createApp({
    authToken: 'session-auth',
    chatService: {
      async compactThread({ slotId, threadId, workspace }) {
        calls.push({ slotId, threadId, workspace });
        return { ok: true, threadId };
      },
    },
  });

  await withServer(app, async ({ port }) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/v2/thread/compact`, {
      method: 'POST',
      headers: { Authorization: 'Bearer session-auth', 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ slotId: 'tab-1', threadId: 'thread-9', workspace: 'D:/workspaces/My-Code-X' }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(calls, [{ slotId: 'tab-1', threadId: 'thread-9', workspace: 'D:/workspaces/My-Code-X' }]);
    assert.deepEqual(body, { ok: true, threadId: 'thread-9' });
  });
});

test('POST /api/v2/thread/rollback rolls back the active thread by the requested turn count', async () => {
  const calls = [];
  const app = createApp({
    authToken: 'session-auth',
    chatService: {
      async rollbackThread({ slotId, threadId, workspace, numTurns }) {
        calls.push({ slotId, threadId, workspace, numTurns });
        return { ok: true, threadId };
      },
    },
  });

  await withServer(app, async ({ port }) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/v2/thread/rollback`, {
      method: 'POST',
      headers: { Authorization: 'Bearer session-auth', 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ slotId: 'tab-1', threadId: 'thread-9', workspace: 'D:/workspaces/My-Code-X', numTurns: 1 }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(calls, [{ slotId: 'tab-1', threadId: 'thread-9', workspace: 'D:/workspaces/My-Code-X', numTurns: 1 }]);
    assert.deepEqual(body, { ok: true, threadId: 'thread-9' });
  });
});

test('POST /api/v2/thread/fork forks the active thread from a preserved turn boundary', async () => {
  const calls = [];
  const app = createApp({
    authToken: 'session-auth',
    chatService: {
      async forkThread({ slotId, threadId, workspace, preservedTurnCount }) {
        calls.push({ slotId, threadId, workspace, preservedTurnCount });
        return { ok: true, threadId: 'thread-forked' };
      },
    },
  });

  await withServer(app, async ({ port }) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/v2/thread/fork`, {
      method: 'POST',
      headers: { Authorization: 'Bearer session-auth', 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        slotId: 'tab-1',
        threadId: 'thread-9',
        workspace: 'D:/workspaces/My-Code-X',
        preservedTurnCount: 2,
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(calls, [
      { slotId: 'tab-1', threadId: 'thread-9', workspace: 'D:/workspaces/My-Code-X', preservedTurnCount: 2 },
    ]);
    assert.deepEqual(body, { ok: true, threadId: 'thread-forked' });
  });
});

test('POST /api/v2/review/start triggers review start with target and delivery', async () => {
  const calls = [];
  const app = createApp({
    authToken: 'session-auth',
    chatService: {
      async startReview({ slotId, threadId, workspace, delivery, target }) {
        calls.push({ slotId, threadId, workspace, delivery, target });
        return { ok: true, reviewThreadId: 'thread-review-1' };
      },
    },
  });

  await withServer(app, async ({ port }) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/v2/review/start`, {
      method: 'POST',
      headers: { Authorization: 'Bearer session-auth', 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        slotId: 'tab-1',
        threadId: 'thread-9',
        workspace: 'D:/workspaces/My-Code-X',
        delivery: 'detached',
        target: { type: 'baseBranch', branch: 'main' },
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(calls, [
      {
        slotId: 'tab-1',
        threadId: 'thread-9',
        workspace: 'D:/workspaces/My-Code-X',
        delivery: 'detached',
        target: { type: 'baseBranch', branch: 'main' },
      },
    ]);
    assert.deepEqual(body, { ok: true, reviewThreadId: 'thread-review-1' });
  });
});
