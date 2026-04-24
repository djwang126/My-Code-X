import test from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../../../app/app.js';
import { readSseUntil, withServer } from '../testing/chat-controller-test-helpers.js';

test('GET /api/v2/chat/events sends snapshot first and then live thread events', async () => {
  let subscriber = null;
  const app = createApp({
    authToken: 'session-auth',
    chatService: {
      getSessionState({ slotId, threadId }) {
        assert.deepEqual({ slotId, threadId }, { slotId: 'tab-1', threadId: 'thread-9' });
        return {
          slotId: 'tab-1',
          viewerId: 'viewer-1',
          threadId: 'thread-9',
          latestTurn: {
        id: 'turn-9',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
          threadStatus: null,
          messages: [{ id: 'user:turn-9', role: 'user', text: 'Explain this bug', state: 'complete', threadId: 'thread-9', turnId: 'turn-9' }],
          lastError: null,
          lastUpdatedAt: '2026-04-03T12:00:00.000Z',
        };
      },
      subscribe({ slotId, threadId }, listener) {
        assert.deepEqual({ slotId, threadId }, { slotId: 'tab-1', threadId: 'thread-9' });
        subscriber = listener;
        return () => {
          subscriber = null;
        };
      },
    },
  });

  await withServer(app, async ({ port }) => {
    const controller = new AbortController();
    const response = await fetch(`http://127.0.0.1:${port}/api/v2/chat/events?slotId=tab-1&threadId=thread-9`, {
      headers: { Authorization: 'Bearer session-auth' },
      signal: controller.signal,
    });

    queueMicrotask(() => {
      subscriber?.({ type: 'assistant_delta', threadId: 'thread-9', turnId: 'turn-9', messageId: 'assistant:turn-9', delta: 'Partial answer', text: 'Partial answer' });
    });

    const text = await readSseUntil(
      response,
      chunk =>
        chunk.includes('event: snapshot') &&
        chunk.includes('"threadId":"thread-9"') &&
        chunk.includes('event: assistant_delta') &&
        chunk.includes('"delta":"Partial answer"'),
    );

    controller.abort();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'text/event-stream; charset=utf-8');
    assert.match(text, /event: snapshot/);
    assert.match(text, /event: assistant_delta/);
  });
});

test('GET /api/v2/chat/events keeps large command details out of the main SSE transcript payload', async () => {
  let subscriber = null;
  const commandOutput = Array.from({ length: 12 }, (_, index) => `command line ${index + 1}`).join('\n');
  const app = createApp({
    authToken: 'session-auth',
    chatService: {
      getSessionState() {
        return {
          slotId: 'tab-1',
          viewerId: 'viewer-1',
          threadId: 'thread-9',
          latestTurn: {
        id: 'turn-9',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
          threadStatus: null,
          messages: [
            {
              id: 'cmd-1',
              kind: 'special',
              itemType: 'commandExecution',
              text: 'npm test',
              state: 'streaming',
              threadId: 'thread-9',
              turnId: 'turn-9',
              raw: { type: 'commandExecution', id: 'cmd-1', command: 'npm test', aggregatedOutput: commandOutput },
            },
          ],
          notices: [],
          pendingRequests: [],
          threadName: '',
          threadStatusText: '',
          tokenUsageText: '',
          lastError: null,
          lastUpdatedAt: '2026-04-03T12:00:00.000Z',
        };
      },
      subscribe({ slotId, threadId }, listener) {
        assert.deepEqual({ slotId, threadId }, { slotId: 'tab-1', threadId: 'thread-9' });
        subscriber = listener;
        return () => {
          subscriber = null;
        };
      },
    },
  });

  await withServer(app, async ({ port }) => {
    const controller = new AbortController();
    const response = await fetch(`http://127.0.0.1:${port}/api/v2/chat/events?slotId=tab-1&threadId=thread-9`, {
      headers: { Authorization: 'Bearer session-auth' },
      signal: controller.signal,
    });

    queueMicrotask(() => {
      subscriber?.({
        type: 'timeline_item_updated',
        threadId: 'thread-9',
        turnId: 'turn-9',
        item: {
          id: 'cmd-1',
          kind: 'special',
          itemType: 'commandExecution',
          text: 'npm test',
          state: 'complete',
          threadId: 'thread-9',
          turnId: 'turn-9',
          raw: { type: 'commandExecution', id: 'cmd-1', command: 'npm test', aggregatedOutput: commandOutput },
        },
      });
    });

    const text = await readSseUntil(
      response,
      chunk => chunk.includes('event: timeline_item_updated') && chunk.includes('"itemType":"commandExecution"'),
    );

    controller.abort();
    assert.match(text, /event: snapshot/);
    assert.doesNotMatch(text, /command line 1/);
    assert.doesNotMatch(text, /"aggregatedOutput":/);
    assert.doesNotMatch(text, /"command":"npm test"/);
  });
});

test('GET /api/v2/chat/events writes structured payloads for SSE error events', async () => {
  let subscriber = null;
  const app = createApp({
    authToken: 'session-auth',
    chatService: {
      getSessionState() {
        return {
          slotId: 'tab-1',
          viewerId: 'viewer-1',
          threadId: 'thread-9',
          latestTurn: {
        id: 'turn-9',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
          threadStatus: null,
          messages: [],
          lastError: null,
          lastUpdatedAt: '2026-04-03T12:00:00.000Z',
        };
      },
      subscribe({ slotId, threadId }, listener) {
        assert.deepEqual({ slotId, threadId }, { slotId: 'tab-1', threadId: 'thread-9' });
        subscriber = listener;
        return () => {
          subscriber = null;
        };
      },
    },
  });

  await withServer(app, async ({ port }) => {
    const controller = new AbortController();
    const response = await fetch(`http://127.0.0.1:${port}/api/v2/chat/events?slotId=tab-1&threadId=thread-9`, {
      headers: { Authorization: 'Bearer session-auth' },
      signal: controller.signal,
    });

    queueMicrotask(() => {
      subscriber?.({
        type: 'error',
        threadId: 'thread-9',
        turnId: 'turn-9',
        error: {
          message: 'thread/resume failed: thread not found',
          codexErrorInfo: 'other',
          additionalDetails: null,
          httpStatusCode: null,
          willRetry: false,
          threadId: 'thread-9',
          turnId: 'turn-9',
          presentationScope: 'conversation',
          source: 'error_notification',
          raw: {
            message: 'thread/resume failed: thread not found',
          },
        },
      });
    });

    const text = await readSseUntil(
      response,
      chunk => chunk.includes('event: error') && chunk.includes('"message":"thread/resume failed: thread not found"'),
    );

    controller.abort();
    assert.equal(response.status, 200);
    assert.match(text, /event: error/);
    assert.match(text, /"message":"thread\/resume failed: thread not found"/);
  });
});

test('GET /api/v2/chat/events returns 404 when the runtime thread is unknown', async () => {
  const app = createApp({
    authToken: 'session-auth',
    chatService: {
      getSessionState() {
        return null;
      },
      subscribe() {
        throw new Error('subscribe should not be called');
      },
    },
  });

  await withServer(app, async ({ port }) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/v2/chat/events?slotId=tab-1&threadId=thread-9`, {
      headers: { Authorization: 'Bearer session-auth' },
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.deepEqual(body, { error: { code: 'thread_not_found', message: 'thread not found', status: 404 } });
  });
});

test('GET /api/v2/chat/events returns 400 when slotId is missing', async () => {
  const app = createApp({
    authToken: 'session-auth',
    chatService: {
      getSessionState() {
        throw new Error('getSessionState should not be called');
      },
      subscribe() {
        throw new Error('subscribe should not be called');
      },
    },
  });

  await withServer(app, async ({ port }) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/v2/chat/events?threadId=thread-9`, {
      headers: { Authorization: 'Bearer session-auth' },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.deepEqual(body, { error: { code: 'slotid_is_required', message: 'slotId is required', status: 400 } });
  });
});
