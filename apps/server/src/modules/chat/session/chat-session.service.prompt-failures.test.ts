import test from 'node:test';
import assert from 'node:assert/strict';

import { createChatService } from '../index.js';
import {
  NORMAL_PROMPT_OVERRIDE_INSTRUCTIONS,
  createPromptOverrideResolverWithFailures,
} from '../testing/chat-service-test-helpers.js';

test('sendMessage preserves prompt override resolver failures from thread start', async () => {
  const service = createChatService({
    promptOverrideResolver: {
      async resolvePromptOverride(promptOverride) {
        throw new Error(`prompt override not found: ${promptOverride}`);
      },
    },
    codexGateway: {
      async startThread() {
        throw new Error('prompt override not found: missing-prompt');
      },
      async resumeThread() {
        throw new Error('resumeThread should not be called');
      },
      async startTurn() {
        throw new Error('startTurn should not be called');
      },
    },
    now: () => '2026-04-03T10:00:00.000Z',
  });

  await assert.rejects(
    service.sendMessage({
      viewerId: 'viewer-1',
      slotId: 'tab-1',
      threadId: '',
      text: 'first message',
      runtimeSettings: {
        promptOverride: 'missing-prompt',
      },
    }),
    error => error instanceof Error && error.message === 'prompt override not found: missing-prompt',
  );
});

test('sendMessage preserves the previously applied prompt override when re-resolution fails on an existing thread', async () => {
  const calls = [];
  const service = createChatService({
    promptOverrideResolver: {
      async resolvePromptOverride(promptOverride) {
        if (promptOverride === 'normal') {
          return NORMAL_PROMPT_OVERRIDE_INSTRUCTIONS;
        }

        throw new Error(`prompt override not found: ${promptOverride}`);
      },
    },
    codexGateway: {
      async startThread({ baseInstructions }) {
        calls.push({ method: 'startThread', baseInstructions });
        return { threadId: 'thread-1' };
      },
      async resumeThread() {
        calls.push({ method: 'resumeThread' });
        throw new Error('resumeThread should not be called when prompt resolution fails first');
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

  await assert.rejects(
    service.sendMessage({
      viewerId: 'viewer-1',
      slotId: 'tab-1',
      threadId: 'thread-1',
      text: 'second message',
      runtimeSettings: {
        promptOverride: 'cat',
      },
    }),
    error => error instanceof Error && error.message === 'prompt override not found: cat',
  );

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

  assert.equal(service.getSessionState({ slotId: 'tab-1', threadId: 'thread-1' })?.appliedThreadRuntimeOverrides?.promptOverride, 'normal');
});

[
  {
    name: 'invalid prompt path',
    promptOverride: 'folder',
    errorMessage: 'prompt override is invalid: folder',
  },
].forEach(({ name, promptOverride, errorMessage }) => {
  test(`sendMessage preserves the previously applied prompt override when re-resolution fails for ${name}`, async () => {
    const calls = [];
    const service = createChatService({
      promptOverrideResolver: createPromptOverrideResolverWithFailures(new Map([[promptOverride, new Error(errorMessage)]])),
      codexGateway: {
        async startThread({ baseInstructions }) {
          calls.push({ method: 'startThread', baseInstructions });
          return { threadId: 'thread-1' };
        },
        async resumeThread() {
          calls.push({ method: 'resumeThread' });
          throw new Error('resumeThread should not be called when prompt resolution fails first');
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
      turn: {
        id: 'turn-1',
        status: 'completed',
      },
    });

    await assert.rejects(
      service.sendMessage({
        viewerId: 'viewer-1',
        slotId: 'tab-1',
        threadId: 'thread-1',
        text: 'second message',
        runtimeSettings: {
          promptOverride,
        },
      }),
      error => error instanceof Error && error.message === errorMessage,
    );

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

    assert.equal(service.getSessionState({ slotId: 'tab-1', threadId: 'thread-1' })?.appliedThreadRuntimeOverrides?.promptOverride, 'normal');
  });
});
