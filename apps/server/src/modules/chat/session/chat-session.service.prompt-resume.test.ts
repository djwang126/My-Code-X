import test from 'node:test';
import assert from 'node:assert/strict';

import { createChatService } from '../index.js';
import {
  NORMAL_PROMPT_OVERRIDE_INSTRUCTIONS,
  createPromptOverrideResolver,
} from '../testing/chat-service-test-helpers.js';

test('sendMessage clears a previously applied prompt override by resuming the thread before the next turn', async () => {
  const calls = [];
  const service = createChatService({
    promptOverrideResolver: createPromptOverrideResolver(),
    codexGateway: {
      async startThread({ baseInstructions }) {
        calls.push({ method: 'startThread', baseInstructions });
        return { threadId: 'thread-1' };
      },
      async resumeThread({ threadId, baseInstructions }) {
        calls.push({ method: 'resumeThread', threadId, baseInstructions });
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

  await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    threadId: 'thread-1',
    text: 'second message',
    runtimeSettings: {
      promptOverride: null,
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
      baseInstructions: undefined,
    },
    {
      method: 'startTurn',
      threadId: 'thread-1',
      text: 'second message',
      runtimeSettings: {
        promptOverride: null,
      },
    },
  ]);
});

test('sendMessage does not resume the thread when the selected prompt override is unchanged', async () => {
  const calls = [];
  const service = createChatService({
    promptOverrideResolver: createPromptOverrideResolver(),
    codexGateway: {
      async startThread({ baseInstructions }) {
        calls.push({ method: 'startThread', baseInstructions });
        return { threadId: 'thread-1' };
      },
      async resumeThread({ threadId, baseInstructions }) {
        calls.push({ method: 'resumeThread', threadId, baseInstructions });
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

  await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
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
      method: 'startTurn',
      threadId: 'thread-1',
      text: 'second message',
      runtimeSettings: {
        promptOverride: 'normal',
      },
    },
  ]);
});
