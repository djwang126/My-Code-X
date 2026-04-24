import test from 'node:test';
import assert from 'node:assert/strict';

import { createChatService } from '../index.js';

test('interruptTurn sends the stop request while the Codex turn remains in progress', async () => {
  const service = createChatService({
    codexGateway: {
      async startThread() {
        return { threadId: 'thread-1' };
      },
      async resumeThread() {
        throw new Error('resumeThread should not be called');
      },
      async startTurn() {
        return { turnId: 'turn-1' };
      },
      async interruptTurn() {
        return { ok: true };
      },
    },
    now: () => '2026-04-19T10:00:00.000Z',
  });

  await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    threadId: '',
    text: 'hello codex',
  });

  const result = await service.interruptTurn({
    slotId: 'tab-1',
    threadId: 'thread-1',
  });

  assert.deepEqual(result, {
    ok: true,
    threadId: 'thread-1',
    turn: {
        id: 'turn-1',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
  });
  assert.equal(service.getSessionState({ slotId: 'tab-1', threadId: 'thread-1' })?.latestTurn?.status, 'inProgress');
});

test('turn completion records the interrupted Codex turn and restores fresh input', async () => {
  const service = createChatService({
    codexGateway: {
      async startThread() {
        return { threadId: 'thread-1' };
      },
      async resumeThread() {
        throw new Error('resumeThread should not be called');
      },
      async startTurn() {
        return { turnId: 'turn-1' };
      },
      async interruptTurn() {
        return { ok: true };
      },
    },
    now: () => '2026-04-19T10:00:00.000Z',
  });

  await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    threadId: '',
    text: 'hello codex',
  });
  await service.interruptTurn({
    slotId: 'tab-1',
    threadId: 'thread-1',
  });

  service.applyGatewayEvent({
    type: 'turn_completed',
    threadId: 'thread-1',
    turn: {
      id: 'turn-1',
      status: 'interrupted',
      error: null,
    },
  });

  const sessionState = service.getSessionState({ slotId: 'tab-1', threadId: 'thread-1' });

  assert.equal(sessionState?.latestTurn?.status, 'interrupted');
  assert.equal(sessionState?.latestTurn?.id, 'turn-1');
});

test('assistant deltas keep the Codex turn in progress after an interrupt has been accepted', async () => {
  const service = createChatService({
    codexGateway: {
      async startThread() {
        return { threadId: 'thread-1' };
      },
      async resumeThread() {
        throw new Error('resumeThread should not be called');
      },
      async startTurn() {
        return { turnId: 'turn-1' };
      },
      async interruptTurn() {
        return { ok: true };
      },
    },
    now: () => '2026-04-19T10:00:00.000Z',
  });

  await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    threadId: '',
    text: 'hello codex',
  });
  await service.interruptTurn({
    slotId: 'tab-1',
    threadId: 'thread-1',
  });

  service.applyGatewayEvent({
    type: 'agent_message_delta',
    threadId: 'thread-1',
    turnId: 'turn-1',
    itemId: 'assistant:turn-1',
    delta: 'still streaming',
  });

  const sessionState = service.getSessionState({ slotId: 'tab-1', threadId: 'thread-1' });

  assert.equal(sessionState?.latestTurn?.status, 'inProgress');
  assert.equal(sessionState?.messages.at(-1)?.text, 'still streaming');
});
