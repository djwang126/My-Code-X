import test from 'node:test';
import assert from 'node:assert/strict';

import { createChatService } from '../index.js';
import { CAT_PROMPT_OVERRIDE_INSTRUCTIONS, createAssistantTimelineMessage, createPromptOverrideResolver, createUserTimelineMessage } from '../testing/chat-service-test-helpers.js';

test('interruptTurn interrupts the active turn tracked by the runtime', async () => {
  const calls = [];
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
      async interruptTurn({ threadId, turnId }) {
        calls.push({ method: 'interruptTurn', threadId, turnId });
        return { ok: true };
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

  const result = await service.interruptTurn({
    slotId: 'tab-1',
    threadId: 'thread-1',
  });

  assert.deepEqual(calls, [{ method: 'interruptTurn', threadId: 'thread-1', turnId: 'turn-1' }]);
  assert.deepEqual(result, {
    ok: true,
    threadId: 'thread-1',
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

test('forkThread creates a new thread and rolls it back to the preserved completed turn count', async () => {
  const calls = [];
  const service = createChatService({
    promptOverrideResolver: createPromptOverrideResolver(),
    codexGateway: {
      async startThread() {
        return { threadId: 'thread-1' };
      },
      async resumeThread() {
        throw new Error('resumeThread should not be called');
      },
      async startTurn({ threadId, text }) {
        calls.push({ method: 'startTurn', threadId, text });
        return { turnId: `turn-${calls.filter(call => call.method === 'startTurn').length}` };
      },
      async forkThread({ threadId, workspace, runtimeSettings, baseInstructions }) {
        calls.push({ method: 'forkThread', threadId, workspace, runtimeSettings, baseInstructions });
        return { threadId: 'thread-forked' };
      },
      async rollbackThread({ threadId, numTurns }) {
        calls.push({ method: 'rollbackThread', threadId, numTurns });
        return { ok: true, threadId };
      },
    },
    now: () => '2026-04-03T10:00:00.000Z',
  });

  await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    workspace: 'D:/workspaces/My-Code-X',
    threadId: '',
    text: 'first message',
    runtimeSettings: {
      promptOverride: 'cat',
      modelContextWindow: 200_000,
      modelAutoCompactTokenLimit: 150_000,
    },
  });

  service.applyGatewayEvent({
    type: 'item_completed',
    threadId: 'thread-1',
    turnId: 'turn-1',
    item: { type: 'agentMessage', id: 'assistant:turn-1', text: 'first answer' },
  });
  service.applyGatewayEvent({
    type: 'turn_completed',
    threadId: 'thread-1',
    turn: { id: 'turn-1', status: 'completed', error: null },
  });

  await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    workspace: 'D:/workspaces/My-Code-X',
    threadId: 'thread-1',
    text: 'second message',
    runtimeSettings: {
      promptOverride: 'cat',
      modelContextWindow: 200_000,
      modelAutoCompactTokenLimit: 150_000,
    },
  });

  service.applyGatewayEvent({
    type: 'item_completed',
    threadId: 'thread-1',
    turnId: 'turn-2',
    item: { type: 'agentMessage', id: 'assistant:turn-2', text: 'second answer' },
  });
  service.applyGatewayEvent({
    type: 'turn_completed',
    threadId: 'thread-1',
    turn: { id: 'turn-2', status: 'completed', error: null },
  });

  const result = await service.forkThread({
    slotId: 'tab-1',
    threadId: 'thread-1',
    workspace: 'D:/workspaces/My-Code-X',
    preservedTurnCount: 1,
  });

  assert.deepEqual(result, {
    ok: true,
    threadId: 'thread-forked',
  });
  assert.deepEqual(calls, [
    { method: 'startTurn', threadId: 'thread-1', text: 'first message' },
    { method: 'startTurn', threadId: 'thread-1', text: 'second message' },
    {
      method: 'forkThread',
      threadId: 'thread-1',
      workspace: 'D:/workspaces/My-Code-X',
      runtimeSettings: {
        promptOverride: 'cat',
        modelContextWindow: 200_000,
        modelAutoCompactTokenLimit: 150_000,
      },
      baseInstructions: CAT_PROMPT_OVERRIDE_INSTRUCTIONS,
    },
    { method: 'rollbackThread', threadId: 'thread-forked', numTurns: 1 },
  ]);
});

test('rollbackThread refreshes the same-thread runtime so the next hydrate sees rolled back messages', async () => {
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
        id: 'turn-1',
        status: 'completed',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
          messages: [
            createUserTimelineMessage({ threadId, turnId: 'turn-1', text: 'first message' }),
            createAssistantTimelineMessage({ threadId, turnId: 'turn-1', text: 'first answer', state: 'complete' }),
          ],
        };
      },
      async startTurn({ threadId, text }) {
        calls.push({ method: 'startTurn', threadId, text });
        return { turnId: `turn-${calls.filter(call => call.method === 'startTurn').length}` };
      },
      async rollbackThread({ threadId, workspace, numTurns }) {
        calls.push({ method: 'rollbackThread', threadId, workspace, numTurns });
        return { ok: true, threadId };
      },
    },
    now: () => '2026-04-03T10:00:00.000Z',
  });

  await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    workspace: 'D:/workspaces/My-Code-X',
    threadId: '',
    text: 'first message',
  });

  service.applyGatewayEvent({
    type: 'item_completed',
    threadId: 'thread-1',
    turnId: 'turn-1',
    item: { type: 'agentMessage', id: 'assistant:turn-1', text: 'first answer' },
  });
  service.applyGatewayEvent({
    type: 'turn_completed',
    threadId: 'thread-1',
    turn: { id: 'turn-1', status: 'completed', error: null },
  });

  await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    workspace: 'D:/workspaces/My-Code-X',
    threadId: 'thread-1',
    text: 'second message',
  });

  service.applyGatewayEvent({
    type: 'item_completed',
    threadId: 'thread-1',
    turnId: 'turn-2',
    item: { type: 'agentMessage', id: 'assistant:turn-2', text: 'second answer' },
  });
  service.applyGatewayEvent({
    type: 'turn_completed',
    threadId: 'thread-1',
    turn: { id: 'turn-2', status: 'completed', error: null },
  });

  const rollbackResult = await service.rollbackThread({
    slotId: 'tab-1',
    threadId: 'thread-1',
    workspace: 'D:/workspaces/My-Code-X',
    numTurns: 1,
  });

  assert.deepEqual(rollbackResult, {
    ok: true,
    threadId: 'thread-1',
  });

  const hydrated = await service.hydrateSession({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    workspace: 'D:/workspaces/My-Code-X',
    threadId: 'thread-1',
  });

  assert.deepEqual(hydrated.messages, [
    createUserTimelineMessage({ threadId: 'thread-1', turnId: 'turn-1', text: 'first message' }),
    createAssistantTimelineMessage({ threadId: 'thread-1', turnId: 'turn-1', text: 'first answer', state: 'complete' }),
  ]);
  assert.equal(hydrated.latestTurn?.id, 'turn-1');
  assert.equal(hydrated.latestTurn?.status, 'completed');
  assert.deepEqual(calls, [
    { method: 'startTurn', threadId: 'thread-1', text: 'first message' },
    { method: 'startTurn', threadId: 'thread-1', text: 'second message' },
    {
      method: 'rollbackThread',
      threadId: 'thread-1',
      workspace: 'D:/workspaces/My-Code-X',
      numTurns: 1,
    },
    { method: 'resumeThread', threadId: 'thread-1' },
  ]);
});
