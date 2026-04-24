import test from 'node:test';
import assert from 'node:assert/strict';

import { createChatService } from '../index.js';
import { createAssistantTimelineMessage, createUserTimelineMessage } from '../testing/chat-service-test-helpers.js';

test('hydrateSession allows the same slot to switch to a different thread and replaces the runtime binding', async () => {
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
          latestTurn: {
            turnId: `turn:${threadId}`,
            status: 'completed',
          },
          messages: [
            {
              id: `user:${threadId}`,
              role: 'user',
              text: `restored ${threadId}`,
              state: 'complete',
              threadId,
              turnId: `turn:${threadId}`,
            },
          ],
        };
      },
      async startTurn({ threadId, text }) {
        calls.push({ method: 'startTurn', threadId, text });
        return { turnId: `send:${threadId}` };
      },
    },
    now: () => '2026-04-03T10:00:00.000Z',
  });

  await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    workspace: 'D:/workspaces/My-Code-X',
    threadId: '',
    text: 'hello codex',
  });

  service.applyGatewayEvent({
    type: 'turn_completed',
    threadId: 'thread-1',
    turn: { id: 'send:thread-1', status: 'completed', error: null },
  });

  const switched = await service.hydrateSession({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    workspace: 'D:/workspaces/My-Code-X',
    threadId: 'thread-2',
  });

  assert.equal(switched.threadId, 'thread-2');
  assert.deepEqual(switched.messages, [
    {
      id: 'user:thread-2',
      role: 'user',
      text: 'restored thread-2',
      state: 'complete',
      threadId: 'thread-2',
      turnId: 'turn:thread-2',
    },
  ]);
  assert.equal(service.getSessionState({ slotId: 'tab-1', threadId: 'thread-1' }), null);
  assert.equal(service.getSessionState({ slotId: 'tab-1', threadId: 'thread-2' })?.threadId, 'thread-2');

  const sendResult = await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    workspace: 'D:/workspaces/My-Code-X',
    threadId: 'thread-2',
    text: 'follow up on switched thread',
  });

  assert.deepEqual(sendResult, {
    threadId: 'thread-2',
    latestTurn: {
        id: 'send:thread-2',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
  });
  assert.deepEqual(calls, [
    { method: 'startTurn', threadId: 'thread-1', text: 'hello codex' },
    { method: 'resumeThread', threadId: 'thread-2' },
    { method: 'startTurn', threadId: 'thread-2', text: 'follow up on switched thread' },
  ]);
});

test('hydrateSession returns the in-memory runtime without re-resuming after background recovery', async () => {
  let resumeCalls = 0;
  const service = createChatService({
    codexGateway: {
      async startThread() {
        return { threadId: 'thread-1' };
      },
      async resumeThread() {
        resumeCalls += 1;
        throw new Error('resumeThread should not be called');
      },
      async startTurn() {
        return { turnId: 'turn-1' };
      },
    },
    now: () => '2026-04-03T10:00:00.000Z',
  });

  await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    threadId: '',
    text: 'hello codex',
  });

  service.applyGatewayEvent({
    type: 'agent_message_delta',
    threadId: 'thread-1',
    turnId: 'turn-1',
    itemId: 'assistant:turn-1',
    delta: 'partial reply',
  });

  const result = await service.hydrateSession({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    threadId: 'thread-1',
  });

  assert.equal(resumeCalls, 0);
  assert.deepEqual(result.messages, [
    createUserTimelineMessage({
      threadId: 'thread-1',
      turnId: 'turn-1',
      text: 'hello codex',
    }),
    createAssistantTimelineMessage({
      threadId: 'thread-1',
      turnId: 'turn-1',
      text: 'partial reply',
      state: 'streaming',
    }),
  ]);
  assert.equal(result.latestTurn?.status, 'running');
});

test('hydrateSession preserves the raw resume error text', async () => {
  const service = createChatService({
    codexGateway: {
      async startThread() {
        throw new Error('startThread should not be called');
      },
      async resumeThread() {
        throw new Error('thread/resume failed: thread not found');
      },
      async startTurn() {
        throw new Error('startTurn should not be called');
      },
    },
    now: () => '2026-04-03T10:00:00.000Z',
  });

  await assert.rejects(
    service.hydrateSession({
      viewerId: 'viewer-1',
      slotId: 'tab-1',
      threadId: 'missing-thread',
    }),
    error => error instanceof Error && error.message === 'thread/resume failed: thread not found',
  );
});

test('hydrateSession preserves the current runtime when a different slot fails to take over the thread', async () => {
  const service = createChatService({
    codexGateway: {
      async startThread() {
        return { threadId: 'thread-1' };
      },
      async resumeThread() {
        throw new Error('resume boom');
      },
      async startTurn() {
        return { turnId: 'turn-1' };
      },
    },
    now: () => '2026-04-03T10:00:00.000Z',
  });

  await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    threadId: '',
    text: 'hello codex',
  });

  await assert.rejects(
    service.hydrateSession({
      viewerId: 'viewer-2',
      slotId: 'tab-2',
      threadId: 'thread-1',
    }),
    error => error instanceof Error && error.message === 'resume boom',
  );

  assert.equal(service.getSessionState({ slotId: 'tab-1', threadId: 'thread-1' })?.threadId, 'thread-1');
  assert.equal(service.getSessionState({ slotId: 'tab-2', threadId: 'thread-1' }), null);
});
