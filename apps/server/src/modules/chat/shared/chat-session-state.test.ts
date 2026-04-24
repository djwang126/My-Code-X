import test from 'node:test';
import assert from 'node:assert/strict';

import { cloneSessionState, createSessionState } from './chat-session-state.js';

test('createSessionState preserves valid state values', () => {
  const state = createSessionState({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    threadId: 'thread-1',
    latestTurn: {
        id: 'turn-1',
        status: 'completed',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
    now: () => '2026-04-20T00:00:00.000Z',
  });

  assert.deepEqual(state.latestTurn, {
    id: 'turn-1',
    status: 'completed',
    error: null,
    startedAt: null,
    completedAt: null,
    durationMs: null,
  });
});

test('createSessionState treats missing latestTurn as no known chat turn', () => {
  const state = createSessionState({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    now: () => '2026-04-20T00:00:00.000Z',
  });

  assert.equal(state.latestTurn, null);
});

test('cloneSessionState preserves state without normalization', () => {
  const cloned = cloneSessionState({
    slotId: 'tab-1',
    viewerId: 'viewer-1',
    workspace: '',
    threadId: 'thread-1',
    latestTurn: {
        id: 'turn-1',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
    threadName: '',
    threadStatus: null,
    threadStatusText: '',
    tokenUsageText: '',
    messages: [],
    notices: [],
    pendingRequests: [],
    lastError: null,
    lastUpdatedAt: '2026-04-20T00:00:00.000Z',
  });

  assert.deepEqual(cloned.latestTurn, {
    id: 'turn-1',
    status: 'inProgress',
    error: null,
    startedAt: null,
    completedAt: null,
    durationMs: null,
  });
});
