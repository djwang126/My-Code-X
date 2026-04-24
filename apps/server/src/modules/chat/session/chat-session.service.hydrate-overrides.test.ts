import test from 'node:test';
import assert from 'node:assert/strict';

import { createChatService } from '../index.js';
import {
  NORMAL_PROMPT_OVERRIDE_INSTRUCTIONS,
  createPromptOverrideResolver,
} from '../testing/chat-service-test-helpers.js';

test('hydrateSession takeover preserves the applied prompt override state for the next send', async () => {
  const calls = [];
  const service = createChatService({
    promptOverrideResolver: createPromptOverrideResolver(),
    codexGateway: {
      async startThread({ baseInstructions }) {
        calls.push({ method: 'startThread', baseInstructions });
        return { threadId: 'thread-1' };
      },
      async resumeThread({ threadId, baseInstructions, runtimeSettings }) {
        calls.push({ method: 'resumeThread', threadId, baseInstructions, runtimeSettings });
        return {
          threadId,
          latestTurn: null,
          messages: [],
        };
      },
      async startTurn({ threadId, text, runtimeSettings }) {
        calls.push({ method: 'startTurn', threadId, text, runtimeSettings });
        return { turnId: `turn-${calls.filter(call => call.method === 'startTurn').length}` };
      },
    },
    now: () => '2026-04-03T10:00:00.000Z',
  });

  await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    threadId: '',
    text: 'first message',
    runtimeSettings: {
      promptOverride: 'normal',
    },
  });

  service.applyGatewayEvent({
    type: 'turn_completed',
    threadId: 'thread-1',
    turn: { id: 'turn-1', status: 'completed', error: null },
  });

  await service.hydrateSession({
    viewerId: 'viewer-2',
    slotId: 'tab-2',
    threadId: 'thread-1',
    runtimeSettings: {
      promptOverride: 'normal',
    },
  });

  await service.sendMessage({
    viewerId: 'viewer-2',
    slotId: 'tab-2',
    threadId: 'thread-1',
    text: 'second message',
    runtimeSettings: {
      promptOverride: 'normal',
    },
  });

  assert.deepEqual(calls, [
    { method: 'startThread', baseInstructions: NORMAL_PROMPT_OVERRIDE_INSTRUCTIONS },
    {
      method: 'startTurn',
      threadId: 'thread-1',
      text: 'first message',
      runtimeSettings: {
        promptOverride: 'normal',
      },
    },
    {
      method: 'resumeThread',
      threadId: 'thread-1',
      baseInstructions: NORMAL_PROMPT_OVERRIDE_INSTRUCTIONS,
      runtimeSettings: {
        promptOverride: 'normal',
      },
    },
    {
      method: 'startTurn',
      threadId: 'thread-1',
      text: 'second message',
      runtimeSettings: {
        promptOverride: 'normal',
      },
    },
  ]);
});

test('hydrateSession restores thread prompt override metadata for resumed tabs', async () => {
  const service = createChatService({
    codexGateway: {
      async startThread({ baseInstructions }) {
        return { threadId: 'thread-1', baseInstructions };
      },
      async resumeThread({ threadId }) {
        return {
          threadId,
          latestTurn: null,
          messages: [],
        };
      },
      async startTurn({ threadId }) {
        return { turnId: threadId === 'thread-1' ? 'turn-1' : 'turn-unknown' };
      },
    },
    now: () => '2026-04-03T10:00:00.000Z',
  });

  await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    threadId: '',
    text: 'first message',
    runtimeSettings: {
      promptOverride: 'normal',
    },
  });

  service.applyGatewayEvent({
    type: 'turn_completed',
    threadId: 'thread-1',
    turn: { id: 'turn-1', status: 'completed', error: null },
  });

  const restored = await service.hydrateSession({
    viewerId: 'viewer-2',
    slotId: 'tab-2',
    threadId: 'thread-1',
  });

  assert.equal(restored.appliedThreadRuntimeOverrides?.promptOverride, 'normal');
});

test('hydrateSession prefers thread prompt override metadata over stale runtime settings from the caller', async () => {
  const service = createChatService({
    codexGateway: {
      async startThread() {
        return { threadId: 'thread-1' };
      },
      async resumeThread({ threadId }) {
        return {
          threadId,
          latestTurn: null,
          messages: [],
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
    slotId: 'tab-1',
    threadId: '',
    text: 'first message',
    runtimeSettings: {
      promptOverride: 'normal',
    },
  });

  service.applyGatewayEvent({
    type: 'turn_completed',
    threadId: 'thread-1',
    turn: { id: 'turn-1', status: 'completed', error: null },
  });

  const restored = await service.hydrateSession({
    viewerId: 'viewer-2',
    slotId: 'tab-2',
    threadId: 'thread-1',
    runtimeSettings: {
      promptOverride: 'cat',
    },
  });

  assert.equal(restored.appliedThreadRuntimeOverrides?.promptOverride, 'normal');
});
