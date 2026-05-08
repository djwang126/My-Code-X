import test from 'node:test';
import assert from 'node:assert/strict';

import { cloneSessionState, createSessionState } from './chat-session-state.js';

test('createSessionState preserves valid lifecycle values', () => {
  const state = createSessionState({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    threadId: 'thread-1',
    turnExecution: {
      activeTurnId: 'turn-1',
      turnLifecycle: 'completed',
    },
    now: () => '2026-04-20T00:00:00.000Z',
  });

  assert.deepEqual(state.turnExecution, {
    activeTurnId: 'turn-1',
    turnLifecycle: 'completed',
  });
});

test('createSessionState rejects missing turnExecution instead of silently inventing compatibility fields', () => {
  assert.throws(
    () =>
      createSessionState({
        viewerId: 'viewer-1',
        slotId: 'tab-1',
        now: () => '2026-04-20T00:00:00.000Z',
      } as any),
    /createSessionState\.turnExecution\.activeTurnId must be a non-empty string or null\./,
  );
});

test('cloneSessionState preserves lifecycle without normalization', () => {
  const cloned = cloneSessionState({
    slotId: 'tab-1',
    viewerId: 'viewer-1',
    workspace: '',
    threadId: 'thread-1',
    turnExecution: {
      activeTurnId: 'turn-1',
      turnLifecycle: 'interrupting',
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

  assert.deepEqual(cloned.turnExecution, {
    activeTurnId: 'turn-1',
    turnLifecycle: 'interrupting',
  });
});
