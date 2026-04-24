import test from 'node:test';
import assert from 'node:assert/strict';

import { createChatService } from '../index.js';

test('sendMessage resumes the provided thread when the slot has no in-memory runtime yet', async () => {
  const calls = [];
  const service = createChatService({
    codexGateway: {
      async startThread() {
        throw new Error('startThread should not be called');
      },
      async resumeThread({ threadId }) {
        calls.push({ method: 'resumeThread', threadId });
        return {
          threadId,
          latestTurn: null,
          messages: [],
        };
      },
      async startTurn({ threadId, text }) {
        calls.push({ method: 'startTurn', threadId, text });
        return { turnId: 'turn-1' };
      },
    },
    now: () => '2026-04-03T10:00:00.000Z',
  });

  const result = await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    threadId: 'thread-9',
    text: 'hello restored thread',
  });

  assert.deepEqual(calls, [
    { method: 'resumeThread', threadId: 'thread-9' },
    { method: 'startTurn', threadId: 'thread-9', text: 'hello restored thread' },
  ]);

  assert.deepEqual(result, {
    threadId: 'thread-9',
    latestTurn: {
        id: 'turn-1',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
  });
});

test('hydrateSession resumes an unknown thread and returns restored transcript state', async () => {
  const calls = [];
  const service = createChatService({
    codexGateway: {
      async startThread() {
        throw new Error('startThread should not be called');
      },
      async resumeThread({ threadId }) {
        calls.push({ method: 'resumeThread', threadId });
        return {
          threadId,
          latestTurn: {
        id: 'turn-9',
        status: 'completed',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
          collaborationModeKind: 'plan',
          messages: [
            {
              id: 'user:turn-9',
              role: 'user',
              text: 'restored prompt',
              state: 'complete',
              threadId,
              turnId: 'turn-9',
            },
            {
              id: 'assistant:turn-9',
              role: 'assistant',
              text: 'restored answer',
              state: 'complete',
              threadId,
              turnId: 'turn-9',
            },
          ],
        };
      },
      async startTurn() {
        throw new Error('startTurn should not be called');
      },
    },
    now: () => '2026-04-03T10:00:00.000Z',
  });

  const result = await service.hydrateSession({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    threadId: 'thread-9',
  });

  assert.deepEqual(calls, [{ method: 'resumeThread', threadId: 'thread-9' }]);
  assert.deepEqual(result, {
    slotId: 'tab-1',
    viewerId: 'viewer-1',
    workspace: '',
    threadId: 'thread-9',
    latestTurn: {
        id: 'turn-9',
        status: 'completed',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
    collaborationModeKind: 'plan',
    threadName: '',
    threadStatus: null,
    threadStatusText: '',
    tokenUsageText: '',
    messages: [
      {
        id: 'user:turn-9',
        role: 'user',
        text: 'restored prompt',
        state: 'complete',
        threadId: 'thread-9',
        turnId: 'turn-9',
      },
      {
        id: 'assistant:turn-9',
        role: 'assistant',
        text: 'restored answer',
        state: 'complete',
        threadId: 'thread-9',
        turnId: 'turn-9',
      },
    ],
    notices: [],
    pendingRequests: [],
    lastError: null,
    lastUpdatedAt: '2026-04-03T10:00:00.000Z',
  });
});

test('hydrateSession keeps special, empty reasoning, and fallback transcript items from upstream thread resume without local reconstruction', async () => {
  const calls = [];
  const service = createChatService({
    codexGateway: {
      async startThread() {
        throw new Error('startThread should not be called');
      },
      async resumeThread({ threadId }) {
        calls.push({ method: 'resumeThread', threadId });
        return {
          threadId,
          latestTurn: {
        id: 'turn-10',
        status: 'completed',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
          messages: [
            {
              id: 'plan-1',
              kind: 'special',
              itemType: 'plan',
              text: 'Inspect reducer state',
              state: 'streaming',
              threadId,
              turnId: 'turn-10',
            },
            {
              id: 'reasoning-empty',
              kind: 'special',
              itemType: 'reasoning',
              text: '',
              state: 'complete',
              threadId,
              turnId: 'turn-10',
            },
            {
              id: 'fallback-1',
              kind: 'fallback',
              itemType: 'totallyUnknownThing',
              text: '[totallyUnknownThing]',
              state: 'complete',
              threadId,
              turnId: 'turn-10',
            },
          ],
        };
      },
      async startTurn() {
        throw new Error('startTurn should not be called');
      },
    },
    now: () => '2026-04-03T10:00:00.000Z',
  });

  const result = await service.hydrateSession({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    threadId: 'thread-10',
  });

  assert.deepEqual(calls, [{ method: 'resumeThread', threadId: 'thread-10' }]);
  assert.deepEqual(result.messages, [
    {
      id: 'plan-1',
      kind: 'special',
      itemType: 'plan',
      text: 'Inspect reducer state',
      state: 'streaming',
      threadId: 'thread-10',
      turnId: 'turn-10',
    },
    {
      id: 'reasoning-empty',
      kind: 'special',
      itemType: 'reasoning',
      text: '',
      state: 'complete',
      threadId: 'thread-10',
      turnId: 'turn-10',
    },
    {
      id: 'fallback-1',
      kind: 'fallback',
      itemType: 'totallyUnknownThing',
      text: '[totallyUnknownThing]',
      state: 'complete',
      threadId: 'thread-10',
      turnId: 'turn-10',
    },
  ]);
});

test('hydrateSession fails explicitly when resumeThread omits latestTurn?.status', async () => {
  const service = createChatService({
    codexGateway: {
      async startThread() {
        throw new Error('startThread should not be called');
      },
      async resumeThread({ threadId }) {
        return {
          threadId,
          latestTurn: {
            turnId: null,
          },
          messages: [],
        };
      },
      async startTurn() {
        throw new Error('startTurn should not be called');
      },
    },
    now: () => '2026-04-03T10:00:00.000Z',
  });

  await assert.rejects(
    () =>
      service.hydrateSession({
        viewerId: 'viewer-1',
        slotId: 'tab-1',
        threadId: 'thread-missing-state',
      }),
    error =>
      error instanceof Error &&
      error.message ===
        'resumeResult.latestTurn?.status must be one of idle, running, interrupting, completed, interrupted, or failed.',
  );
});
