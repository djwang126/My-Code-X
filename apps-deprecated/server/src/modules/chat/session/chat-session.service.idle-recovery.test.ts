import test from 'node:test';
import assert from 'node:assert/strict';

import { createChatService } from '../index.js';
import { createAssistantTimelineMessage, createUserTimelineMessage } from '../testing/chat-service-test-helpers.js';

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
          createUserTimelineMessage({ threadId, turnId: 'restored-turn-1', text: 'restored prompt' }),
          createAssistantTimelineMessage({
            threadId,
            turnId: 'restored-turn-1',
            text: 'restored answer',
            state: 'complete',
          }),
        ],
      };
    },
    async startTurn({ threadId, text }) {
      calls.push({ method: 'startTurn', threadId, text });
      return { turnId: `turn-${calls.filter(call => call.method === 'startTurn').length}` };
    },
  };
}

async function startAndCompleteThread(service) {
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

function createInfoLogger() {
  const messages = [];

  return {
    messages,
    info(message) {
      messages.push(message);
    },
  };
}

test('sendMessage resumes a stale in-memory runtime before starting the next turn after an idle restart', async () => {
  const gateway = createMutableGateway();
  const service = createChatService({
    codexGateway: gateway,
    now: () => '2026-04-17T12:00:00.000Z',
  });

  await startAndCompleteThread(service);
  gateway.runtime.active = false;

  await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    workspace: 'D:/workspaces/My-Code-X',
    threadId: 'thread-1',
    text: 'continue after idle shutdown',
  });

  assert.deepEqual(gateway.calls, [
    { method: 'startThread' },
    { method: 'startTurn', threadId: 'thread-1', text: 'hello codex' },
    { method: 'resumeThread', threadId: 'thread-1' },
    { method: 'startTurn', threadId: 'thread-1', text: 'continue after idle shutdown' },
  ]);
});

test('hydrateSession re-resumes a stale in-memory runtime instead of returning the stale clone', async () => {
  const gateway = createMutableGateway();
  const service = createChatService({
    codexGateway: gateway,
    now: () => '2026-04-17T12:00:00.000Z',
  });

  await startAndCompleteThread(service);
  service.applyGatewayEvent({
    type: 'agent_message_delta',
    threadId: 'thread-1',
    turnId: 'turn-1',
    itemId: 'assistant:turn-1',
    delta: 'stale partial reply',
  });
  gateway.runtime.active = false;

  const hydrated = await service.hydrateSession({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    workspace: 'D:/workspaces/My-Code-X',
    threadId: 'thread-1',
  });

  assert.deepEqual(gateway.calls, [
    { method: 'startThread' },
    { method: 'startTurn', threadId: 'thread-1', text: 'hello codex' },
    { method: 'resumeThread', threadId: 'thread-1' },
  ]);
  assert.deepEqual(hydrated.messages, [
    createUserTimelineMessage({ threadId: 'thread-1', turnId: 'restored-turn-1', text: 'restored prompt' }),
    createAssistantTimelineMessage({
      threadId: 'thread-1',
      turnId: 'restored-turn-1',
      text: 'restored answer',
      state: 'complete',
    }),
  ]);
  assert.equal(hydrated.turnExecution.activeTurnId, 'restored-turn-1');
});

test('sendMessage still reuses an attached runtime without an extra resume', async () => {
  const gateway = createMutableGateway();
  const service = createChatService({
    codexGateway: gateway,
    now: () => '2026-04-17T12:00:00.000Z',
  });

  await startAndCompleteThread(service);

  await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    workspace: 'D:/workspaces/My-Code-X',
    threadId: 'thread-1',
    text: 'follow up while still attached',
  });

  assert.deepEqual(gateway.calls, [
    { method: 'startThread' },
    { method: 'startTurn', threadId: 'thread-1', text: 'hello codex' },
    { method: 'startTurn', threadId: 'thread-1', text: 'follow up while still attached' },
  ]);
});

test('sendMessage re-resumes the runtime and logs the recovery when the gateway generation changed while still active', async () => {
  const gateway = createMutableGateway();
  const logger = createInfoLogger();
  const service = createChatService({
    codexGateway: gateway,
    logger,
    now: () => '2026-04-17T12:00:00.000Z',
  });

  await startAndCompleteThread(service);
  gateway.runtime.generation = 2;

  await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    workspace: 'D:/workspaces/My-Code-X',
    threadId: 'thread-1',
    text: 'continue after external restart',
  });

  assert.deepEqual(gateway.calls, [
    { method: 'startThread' },
    { method: 'startTurn', threadId: 'thread-1', text: 'hello codex' },
    { method: 'resumeThread', threadId: 'thread-1' },
    { method: 'startTurn', threadId: 'thread-1', text: 'continue after external restart' },
  ]);
  assert.deepEqual(logger.messages, [
    '[chat-session-service] restoring stale runtime (send_message) for slot=tab-1 thread=thread-1 workspace=D:/workspaces/My-Code-X reason=gateway_generation_mismatch runtimeGeneration=1 currentGeneration=2',
    '[chat-session-service] restored runtime (send_message) for slot=tab-1 thread=thread-1 workspace=D:/workspaces/My-Code-X gatewayGeneration=2',
  ]);
});

test('hydrateSession still returns the in-memory runtime when it is attached to the current gateway', async () => {
  const gateway = createMutableGateway();
  const service = createChatService({
    codexGateway: gateway,
    now: () => '2026-04-17T12:00:00.000Z',
  });

  await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    text: 'hello codex',
  });

  service.applyGatewayEvent({
    type: 'agent_message_delta',
    threadId: 'thread-1',
    turnId: 'turn-1',
    itemId: 'assistant:turn-1',
    delta: 'partial reply',
  });

  const hydrated = await service.hydrateSession({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    threadId: 'thread-1',
  });

  assert.deepEqual(gateway.calls, [
    { method: 'startThread' },
    { method: 'startTurn', threadId: 'thread-1', text: 'hello codex' },
  ]);
  assert.deepEqual(hydrated.messages, [
    createUserTimelineMessage({ threadId: 'thread-1', turnId: 'turn-1', text: 'hello codex' }),
    createAssistantTimelineMessage({ threadId: 'thread-1', turnId: 'turn-1', text: 'partial reply', state: 'streaming' }),
  ]);
});
