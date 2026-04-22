import test from 'node:test';
import assert from 'node:assert/strict';

import { canShutdownCodexForIdle } from './codex-idle-shutdown-policy.js';

function createSessionTurnExecution(activeTurnId, turnLifecycle) {
  return {
    activeTurnId,
    turnLifecycle,
  };
}

test('canShutdownCodexForIdle allows shutdown when every session is idle and has no pending requests', () => {
  assert.equal(
    canShutdownCodexForIdle({
      activitySnapshot: {
        sessions: [
          {
            slotId: 'tab-1',
            threadId: 'thr-1',
            turnExecution: createSessionTurnExecution('turn-1', 'completed'),
            pendingRequestCount: 0,
          },
          {
            slotId: 'tab-2',
            threadId: '',
            turnExecution: createSessionTurnExecution(null, 'idle'),
            pendingRequestCount: 0,
          },
        ],
      },
    }),
    true,
  );
});

test('canShutdownCodexForIdle blocks shutdown when any session is still active or waiting on a request', () => {
  assert.equal(
    canShutdownCodexForIdle({
      activitySnapshot: {
        sessions: [
          {
            slotId: 'tab-1',
            threadId: 'thr-1',
            turnExecution: createSessionTurnExecution('turn-1', 'running'),
            pendingRequestCount: 0,
          },
          {
            slotId: 'tab-2',
            threadId: 'thr-2',
            turnExecution: createSessionTurnExecution('turn-2', 'completed'),
            pendingRequestCount: 1,
          },
        ],
      },
    }),
    false,
  );
});
