import test from 'node:test';
import assert from 'node:assert/strict';

import { createChatService } from '../index.js';
import { createUserTimelineMessage } from '../testing/chat-service-test-helpers.js';

function createMutableGateway() {
  const calls = [];
  const runtime = {
    generation: 1,
    active: true,
  };

  return {
    calls,
    runtime,
    getGatewayGeneration() {
      return runtime.generation;
    },
    hasActiveGateway() {
      return runtime.active;
    },
    async startThread() {
      calls.push({ method: 'startThread' });
      return { threadId: 'thread-1' };
    },
    async resumeThread({ threadId }) {
      calls.push({ method: 'resumeThread', threadId });
      return {
        threadId,
        turnExecution: {
          activeTurnId: 'restored-turn-1',
          turnLifecycle: 'completed',
        },
        messages: [
          createUserTimelineMessage({
            threadId,
            turnId: 'restored-turn-1',
            text: 'hello codex',
          }),
        ],
      };
    },
    async startTurn({ threadId, text }) {
      calls.push({ method: 'startTurn', threadId, text });
      return { turnId: 'turn-1' };
    },
    async compactThread({ threadId, workspace }) {
      calls.push({ method: 'compactThread', threadId, workspace });
      return { ok: true, threadId };
    },
    async forkThread({ threadId, workspace }) {
      calls.push({ method: 'forkThread', threadId, workspace });
      return { threadId: 'thread-forked' };
    },
    async rollbackThread({ threadId, workspace, numTurns }) {
      calls.push({ method: 'rollbackThread', threadId, workspace, numTurns });
      return { ok: true, threadId };
    },
    async startReview({ threadId, workspace, delivery, target }) {
      calls.push({ method: 'startReview', threadId, workspace, delivery, target });
      return { reviewThreadId: 'thread-review' };
    },
  };
}

async function createIdleThread(service) {
  await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    workspace: 'D:/workspaces/My-Code-X',
    text: 'hello codex',
  });

  service.applyGatewayEvent({
    type: 'turn_completed',
    threadId: 'thread-1',
    turn: { id: 'turn-1', status: 'completed', error: null },
  });
}

test('compactThread restores a stale idle runtime before compacting the thread', async () => {
  const gateway = createMutableGateway();
  const service = createChatService({
    codexGateway: gateway,
    now: () => '2026-04-17T12:00:00.000Z',
  });

  await createIdleThread(service);
  gateway.runtime.active = false;

  await service.compactThread({
    slotId: 'tab-1',
    threadId: 'thread-1',
    workspace: 'D:/workspaces/My-Code-X',
  });

  assert.deepEqual(gateway.calls, [
    { method: 'startThread' },
    { method: 'startTurn', threadId: 'thread-1', text: 'hello codex' },
    { method: 'resumeThread', threadId: 'thread-1' },
    { method: 'compactThread', threadId: 'thread-1', workspace: 'D:/workspaces/My-Code-X' },
  ]);
});

test('forkThread restores a stale idle runtime before forking the thread', async () => {
  const gateway = createMutableGateway();
  const service = createChatService({
    codexGateway: gateway,
    now: () => '2026-04-17T12:00:00.000Z',
  });

  await createIdleThread(service);
  gateway.runtime.active = false;

  await service.forkThread({
    slotId: 'tab-1',
    threadId: 'thread-1',
    workspace: 'D:/workspaces/My-Code-X',
    preservedTurnCount: 1,
  });

  assert.deepEqual(gateway.calls, [
    { method: 'startThread' },
    { method: 'startTurn', threadId: 'thread-1', text: 'hello codex' },
    { method: 'resumeThread', threadId: 'thread-1' },
    { method: 'forkThread', threadId: 'thread-1', workspace: 'D:/workspaces/My-Code-X' },
  ]);
});

test('startReview restores a stale idle runtime before starting review', async () => {
  const gateway = createMutableGateway();
  const service = createChatService({
    codexGateway: gateway,
    now: () => '2026-04-17T12:00:00.000Z',
  });

  await createIdleThread(service);
  gateway.runtime.active = false;

  await service.startReview({
    slotId: 'tab-1',
    threadId: 'thread-1',
    workspace: 'D:/workspaces/My-Code-X',
    delivery: 'inline',
    target: { type: 'uncommittedChanges' },
  });

  assert.deepEqual(gateway.calls, [
    { method: 'startThread' },
    { method: 'startTurn', threadId: 'thread-1', text: 'hello codex' },
    { method: 'resumeThread', threadId: 'thread-1' },
    {
      method: 'startReview',
      threadId: 'thread-1',
      workspace: 'D:/workspaces/My-Code-X',
      delivery: 'inline',
      target: { type: 'uncommittedChanges' },
    },
  ]);
});

test('rollbackThread restores a stale idle runtime before rollback and refreshes again after rollback', async () => {
  const gateway = createMutableGateway();
  const service = createChatService({
    codexGateway: gateway,
    now: () => '2026-04-17T12:00:00.000Z',
  });

  await createIdleThread(service);
  gateway.runtime.active = false;

  await service.rollbackThread({
    slotId: 'tab-1',
    threadId: 'thread-1',
    workspace: 'D:/workspaces/My-Code-X',
    numTurns: 1,
  });

  assert.deepEqual(gateway.calls, [
    { method: 'startThread' },
    { method: 'startTurn', threadId: 'thread-1', text: 'hello codex' },
    { method: 'resumeThread', threadId: 'thread-1' },
    { method: 'rollbackThread', threadId: 'thread-1', workspace: 'D:/workspaces/My-Code-X', numTurns: 1 },
    { method: 'resumeThread', threadId: 'thread-1' },
  ]);
});
