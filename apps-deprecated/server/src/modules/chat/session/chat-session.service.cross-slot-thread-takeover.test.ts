import test from 'node:test';
import assert from 'node:assert/strict';

import { createChatService } from '../index.js';
import { createAssistantTimelineMessage, createUserTimelineMessage } from '../testing/chat-service-test-helpers.js';

test('hydrateSession allows a different slot to attach to a live in-memory thread', async () => {
  const calls = [];
  const service = createChatService({
    codexGateway: {
      async startThread() {
        return { threadId: 'thread-1' };
      },
      async resumeThread({ threadId }) {
        calls.push({ method: 'resumeThread', threadId });
        return {
          threadId,
          turnExecution: {
            activeTurnId: 'turn-1',
            turnLifecycle: 'running',
          },
          messages: [
            createUserTimelineMessage({ threadId, turnId: 'turn-1', text: 'hello codex' }),
            createAssistantTimelineMessage({ threadId, turnId: 'turn-1', text: 'partial reply', state: 'streaming' }),
          ],
        };
      },
      async startTurn() {
        return { turnId: 'turn-1' };
      },
    },
    now: () => '2026-04-03T10:00:00.000Z',
  });

  await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'slot-1',
    threadId: '',
    text: 'hello codex',
  });

  const result = await service.hydrateSession({
    viewerId: 'viewer-2',
    slotId: 'slot-2',
    threadId: 'thread-1',
  });

  assert.deepEqual(calls, [{ method: 'resumeThread', threadId: 'thread-1' }]);
  assert.equal(result.threadId, 'thread-1');
  assert.equal(result.turnExecution.turnLifecycle, 'running');
  assert.equal(service.getSessionState({ slotId: 'slot-1', threadId: 'thread-1' }), null);
  assert.equal(service.getSessionState({ slotId: 'slot-2', threadId: 'thread-1' })?.threadId, 'thread-1');
});

test('hydrateSession allows a different slot to take over a completed thread', async () => {
  const calls = [];
  const service = createChatService({
    codexGateway: {
      async startThread() {
        return { threadId: 'thread-1' };
      },
      async resumeThread({ threadId }) {
        calls.push({ method: 'resumeThread', threadId });
        return {
          threadId,
          turnExecution: {
            activeTurnId: 'turn-1',
            turnLifecycle: 'completed',
          },
          messages: [
            createUserTimelineMessage({ threadId, turnId: 'turn-1', text: 'hello codex' }),
            createAssistantTimelineMessage({ threadId, turnId: 'turn-1', text: 'done now', state: 'complete' }),
          ],
        };
      },
      async startTurn() {
        return { turnId: 'turn-1' };
      },
    },
    now: () => '2026-04-03T10:00:00.000Z',
  });

  await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'slot-1',
    threadId: '',
    text: 'hello codex',
  });

  service.applyGatewayEvent({
    type: 'turn_completed',
    threadId: 'thread-1',
    turn: {
      id: 'turn-1',
      status: 'completed',
      error: null,
    },
  });

  const result = await service.hydrateSession({
    viewerId: 'viewer-2',
    slotId: 'slot-2',
    threadId: 'thread-1',
  });

  assert.deepEqual(calls, [{ method: 'resumeThread', threadId: 'thread-1' }]);
  assert.equal(result.threadId, 'thread-1');
  assert.equal(result.turnExecution.turnLifecycle, 'completed');
  assert.equal(service.getSessionState({ slotId: 'slot-1', threadId: 'thread-1' }), null);
  assert.equal(service.getSessionState({ slotId: 'slot-2', threadId: 'thread-1' })?.threadId, 'thread-1');
});

test('sendMessage lets a different slot take over a live thread but still blocks a new turn while it is running', async () => {
  const calls = [];
  const service = createChatService({
    codexGateway: {
      async startThread() {
        return { threadId: 'thread-1' };
      },
      async resumeThread({ threadId }) {
        calls.push({ method: 'resumeThread', threadId });
        return {
          threadId,
          turnExecution: {
            activeTurnId: 'turn-1',
            turnLifecycle: 'running',
          },
          messages: [
            createUserTimelineMessage({ threadId, turnId: 'turn-1', text: 'hello codex' }),
            createAssistantTimelineMessage({ threadId, turnId: 'turn-1', text: 'partial reply', state: 'streaming' }),
          ],
        };
      },
      async startTurn({ threadId, text }) {
        calls.push({ method: 'startTurn', threadId, text });
        return { turnId: 'turn-1' };
      },
    },
    now: () => '2026-04-03T10:00:00.000Z',
  });

  await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'slot-1',
    threadId: '',
    text: 'hello codex',
  });

  await assert.rejects(
    service.sendMessage({
      viewerId: 'viewer-2',
      slotId: 'slot-2',
      threadId: 'thread-1',
      text: 'steal thread',
    }),
    error => error instanceof Error && error.message === 'turn already in progress',
  );

  assert.deepEqual(calls, [
    { method: 'startTurn', threadId: 'thread-1', text: 'hello codex' },
    { method: 'resumeThread', threadId: 'thread-1' },
  ]);
  assert.equal(service.getSessionState({ slotId: 'slot-1', threadId: 'thread-1' }), null);
  assert.equal(service.getSessionState({ slotId: 'slot-2', threadId: 'thread-1' })?.turnExecution.turnLifecycle, 'running');
});

test('sendMessage allows a different slot to continue a completed thread', async () => {
  const calls = [];
  const service = createChatService({
    codexGateway: {
      async startThread() {
        return { threadId: 'thread-1' };
      },
      async resumeThread({ threadId }) {
        calls.push({ method: 'resumeThread', threadId });
        return {
          threadId,
          turnExecution: {
            activeTurnId: 'turn-1',
            turnLifecycle: 'completed',
          },
          messages: [
            createUserTimelineMessage({ threadId, turnId: 'turn-1', text: 'hello codex' }),
            createAssistantTimelineMessage({ threadId, turnId: 'turn-1', text: 'done now', state: 'complete' }),
          ],
        };
      },
      async startTurn({ threadId, text }) {
        calls.push({ method: 'startTurn', threadId, text });
        return { turnId: 'turn-2' };
      },
    },
    now: () => '2026-04-03T10:00:00.000Z',
  });

  await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'slot-1',
    threadId: '',
    text: 'hello codex',
  });

  service.applyGatewayEvent({
    type: 'turn_completed',
    threadId: 'thread-1',
    turn: {
      id: 'turn-1',
      status: 'completed',
      error: null,
    },
  });

  const result = await service.sendMessage({
    viewerId: 'viewer-2',
    slotId: 'slot-2',
    threadId: 'thread-1',
    text: 'follow up',
  });

  assert.deepEqual(calls, [
    { method: 'startTurn', threadId: 'thread-1', text: 'hello codex' },
    { method: 'resumeThread', threadId: 'thread-1' },
    { method: 'startTurn', threadId: 'thread-1', text: 'follow up' },
  ]);
  assert.equal(result.threadId, 'thread-1');
  assert.equal(result.turnExecution.activeTurnId, 'turn-2');
  assert.equal(service.getSessionState({ slotId: 'slot-1', threadId: 'thread-1' }), null);
  assert.equal(service.getSessionState({ slotId: 'slot-2', threadId: 'thread-1' })?.turnExecution.activeTurnId, 'turn-2');
});
