import test from 'node:test';
import assert from 'node:assert/strict';

import { createChatService } from '../index.js';
import {
  CAT_PROMPT_OVERRIDE_INSTRUCTIONS,
  NORMAL_PROMPT_OVERRIDE_INSTRUCTIONS,
  createPromptOverrideResolver,
} from '../testing/chat-service-test-helpers.js';

test('sendMessage reapplies explicit thread-scoped model config overrides before continuing an existing thread', async () => {
  const calls = [];
  const service = createChatService({
    codexGateway: {
      async startThread() {
        calls.push({ method: 'startThread' });
        return { threadId: 'thread-1' };
      },
      async resumeThread({ threadId, runtimeSettings }) {
        calls.push({ method: 'resumeThread', threadId, runtimeSettings });
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
      modelContextWindow: 200_000,
      modelAutoCompactTokenLimit: 150_000,
    },
  });

  assert.deepEqual(calls, [
    { method: 'startThread' },
    { method: 'startTurn', threadId: 'thread-1', text: 'first message', runtimeSettings: undefined },
    {
      method: 'resumeThread',
      threadId: 'thread-1',
      runtimeSettings: {
        modelContextWindow: 200_000,
        modelAutoCompactTokenLimit: 150_000,
      },
    },
    {
      method: 'startTurn',
      threadId: 'thread-1',
      text: 'second message',
      runtimeSettings: {
        modelContextWindow: 200_000,
        modelAutoCompactTokenLimit: 150_000,
      },
    },
  ]);
});

test('sendMessage reapplies prompt override preferences before continuing an existing thread', async () => {
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
      promptOverride: 'cat',
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
      baseInstructions: CAT_PROMPT_OVERRIDE_INSTRUCTIONS,
    },
    {
      method: 'startTurn',
      threadId: 'thread-1',
      text: 'second message',
      runtimeSettings: {
        promptOverride: 'cat',
      },
    },
  ]);
});

test('sendMessage starts a new thread with the selected prompt override applied as base instructions', async () => {
  const calls = [];
  const service = createChatService({
    promptOverrideResolver: createPromptOverrideResolver(),
    codexGateway: {
      async startThread({ baseInstructions }) {
        calls.push({ method: 'startThread', baseInstructions });
        return { threadId: 'thread-1' };
      },
      async resumeThread() {
        throw new Error('resumeThread should not be called');
      },
      async startTurn({ threadId, text, runtimeSettings }) {
        calls.push({ method: 'startTurn', threadId, text, runtimeSettings });
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
  ]);
});

test('sendMessage trims the selected prompt override before resolving base instructions', async () => {
  const calls = [];
  const service = createChatService({
    promptOverrideResolver: {
      async resolvePromptOverride(promptOverride) {
        assert.equal(promptOverride, 'normal');
        return NORMAL_PROMPT_OVERRIDE_INSTRUCTIONS;
      },
    },
    codexGateway: {
      async startThread({ baseInstructions }) {
        calls.push({ method: 'startThread', baseInstructions });
        return { threadId: 'thread-1' };
      },
      async resumeThread() {
        throw new Error('resumeThread should not be called');
      },
      async startTurn({ threadId, text, runtimeSettings }) {
        calls.push({ method: 'startTurn', threadId, text, runtimeSettings });
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
      promptOverride: '  normal  ',
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
  ]);
});
