import test from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../../../app/app.js';
import { withServer } from '../testing/chat-controller-test-helpers.js';

test('POST /api/v2/chat/message starts a turn and returns the stream URL', async () => {
  const calls = [];
  const app = createApp({
    authToken: 'session-auth',
    chatService: {
      async hydrateSession() {
        throw new Error('hydrateSession should not be called');
      },
      async sendMessage({ viewerId, slotId, workspace, threadId, text, runtimeSettings, collaborationModeKind }) {
        calls.push({ viewerId, slotId, workspace, threadId, text, runtimeSettings, collaborationModeKind });
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
        text: 'Explain this bug',
        runtimeSettings: {
          model: 'gpt-5.4',
          reasoningEffort: 'high',
          approvalPolicy: 'on-request',
          sandboxMode: 'workspace-write',
          collaborationModeKind: 'plan',
        },
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(calls, [
      {
        viewerId: 'viewer-1',
        slotId: 'tab-1',
        workspace: 'D:/workspaces/My-Code-X',
        threadId: 'thread-9',
        text: 'Explain this bug',
        runtimeSettings: {
          model: 'gpt-5.4',
          reasoningEffort: 'high',
          approvalPolicy: 'on-request',
          sandboxMode: 'workspace-write',
        },
        collaborationModeKind: 'plan',
      },
    ]);
    assert.deepEqual(body, {
      threadId: 'thread-9',
      latestTurn: {
        id: 'turn-9',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
      stream: { url: '/api/v2/chat/events?slotId=tab-1&threadId=thread-9' },
    });
  });
});

test('POST /api/v2/chat/message returns 400 when required fields are missing', async () => {
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
        workspace: 'D:/workspaces/My-Code-X',
        threadId: 'thread-9',
        text: 'Explain this bug',
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.deepEqual(body, { error: { code: 'slotid_is_required', message: 'slotId is required', status: 400 } });
  });
});

test('POST /api/v2/chat/message returns 400 for invalid json', async () => {
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
      body: '{"viewerId":"viewer-1"',
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.deepEqual(body, { error: { code: 'invalid_json_body', message: 'invalid json body', status: 400 } });
  });
});

test('POST /api/v2/chat/message preserves the raw runtime error text', async () => {
  const app = createApp({
    authToken: 'session-auth',
    chatService: {
      async hydrateSession() {
        throw new Error('hydrateSession should not be called');
      },
      async sendMessage() {
        throw new Error('thread mismatch for slot session');
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
        text: 'Explain this bug',
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 502);
    assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
    assert.deepEqual(body, {
      error: {
        code: 'thread_mismatch_for_slot_session',
        message: 'thread mismatch for slot session',
        status: 502,
      },
    });
  });
});
