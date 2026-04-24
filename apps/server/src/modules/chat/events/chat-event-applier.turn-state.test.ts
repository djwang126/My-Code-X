import test from 'node:test';
import assert from 'node:assert/strict';

import { createChatService } from '../index.js';
import { createAssistantTimelineMessage, createUserTimelineMessage } from '../testing/chat-service-test-helpers.js';

test('Codex completion events finalize the assistant message and unlock input', async () => {
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

  service.applyGatewayEvent({
    type: 'item_completed',
    threadId: 'thread-1',
    turnId: 'turn-1',
    item: {
      type: 'agentMessage',
      id: 'assistant:turn-1',
      text: 'final reply',
    },
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

  assert.deepEqual(service.getSessionState({ slotId: 'tab-1', threadId: 'thread-1' }), {
    slotId: 'tab-1',
    viewerId: 'viewer-1',
    workspace: '',
    threadId: 'thread-1',
    latestTurn: {
      id: 'turn-1',
      status: 'completed',
      error: null,
      startedAt: null,
      completedAt: null,
      durationMs: null,
    },
    threadName: '',
    threadStatus: null,
    threadStatusText: '',
    tokenUsageText: '',
    messages: [
      createUserTimelineMessage({
        threadId: 'thread-1',
        turnId: 'turn-1',
        text: 'hello codex',
      }),
      createAssistantTimelineMessage({
        threadId: 'thread-1',
        turnId: 'turn-1',
        text: 'final reply',
        state: 'complete',
      }),
    ],
    notices: [],
    pendingRequests: [],
    lastError: null,
    lastUpdatedAt: '2026-04-03T10:00:00.000Z',
  });
});

test('subscribe receives turn start and live Codex thread events for the runtime thread', async () => {
  const events = [];
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
    },
    now: () => '2026-04-03T10:00:00.000Z',
  });

  const unsubscribe = service.subscribe({ slotId: 'tab-1', threadId: 'thread-1' }, event => {
    events.push(event);
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

  service.applyGatewayEvent({
    type: 'item_completed',
    threadId: 'thread-1',
    turnId: 'turn-1',
    item: {
      type: 'agentMessage',
      id: 'assistant:turn-1',
      text: 'final reply',
    },
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

  unsubscribe();

  assert.deepEqual(events, [
    {
      type: 'turn_started',
      threadId: 'thread-1',
      turn: {
        id: 'turn-1',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
    },
    {
      type: 'assistant_delta',
      threadId: 'thread-1',
      turnId: 'turn-1',
      messageId: 'assistant:turn-1',
      delta: 'partial reply',
      text: 'partial reply',
    },
    {
      type: 'message_completed',
      threadId: 'thread-1',
      turnId: 'turn-1',
      message: createAssistantTimelineMessage({
        threadId: 'thread-1',
        turnId: 'turn-1',
        text: 'final reply',
        state: 'complete',
      }),
    },
    {
      type: 'turn_completed',
      threadId: 'thread-1',
      turn: {
        id: 'turn-1',
        status: 'completed',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
      error: null,
    },
  ]);
});

test('Codex error events preserve raw error text and notify subscribers', async () => {
  const events = [];
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
    },
    now: () => '2026-04-03T10:00:00.000Z',
  });

  await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    threadId: '',
    text: 'hello codex',
  });

  service.subscribe({ slotId: 'tab-1', threadId: 'thread-1' }, event => {
    events.push(event);
  });

  service.applyGatewayEvent({
    type: 'error',
    threadId: 'thread-1',
    turnId: 'turn-1',
    error: {
      message: 'codex app-server stdout unavailable',
      codexErrorInfo: { httpConnectionFailed: { httpStatusCode: 502 } },
      additionalDetails: 'upstream timeout',
      httpStatusCode: 502,
      willRetry: true,
      threadId: 'thread-1',
      turnId: 'turn-1',
      presentationScope: 'conversation',
      source: 'error_notification',
      raw: {
        message: 'codex app-server stdout unavailable',
        codexErrorInfo: { httpConnectionFailed: { httpStatusCode: 502 } },
        additionalDetails: 'upstream timeout',
      },
    },
  });

  assert.deepEqual(events, [
    {
      type: 'error',
      threadId: 'thread-1',
      turnId: 'turn-1',
      error: {
        message: 'codex app-server stdout unavailable',
        codexErrorInfo: { httpConnectionFailed: { httpStatusCode: 502 } },
        additionalDetails: 'upstream timeout',
        httpStatusCode: 502,
        willRetry: true,
        threadId: 'thread-1',
        turnId: 'turn-1',
        presentationScope: 'conversation',
        source: 'error_notification',
        raw: {
          message: 'codex app-server stdout unavailable',
          codexErrorInfo: { httpConnectionFailed: { httpStatusCode: 502 } },
          additionalDetails: 'upstream timeout',
        },
      },
    },
  ]);
  assert.deepEqual(
    service.getSessionState({ slotId: 'tab-1', threadId: 'thread-1' })?.lastError,
    {
      message: 'codex app-server stdout unavailable',
      codexErrorInfo: { httpConnectionFailed: { httpStatusCode: 502 } },
      additionalDetails: 'upstream timeout',
      httpStatusCode: 502,
      willRetry: true,
      threadId: 'thread-1',
      turnId: 'turn-1',
      presentationScope: 'conversation',
      source: 'error_notification',
      raw: {
        message: 'codex app-server stdout unavailable',
        codexErrorInfo: { httpConnectionFailed: { httpStatusCode: 502 } },
        additionalDetails: 'upstream timeout',
      },
    },
  );
});

test('turn completion fails explicitly when Codex reports a non-terminal status', async () => {
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
    },
    now: () => '2026-04-03T10:00:00.000Z',
  });

  await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    threadId: '',
    text: 'hello codex',
  });

  assert.throws(
    () =>
      service.applyGatewayEvent({
        type: 'turn_completed',
        threadId: 'thread-1',
        turn: {
          id: 'turn-1',
          status: 'inProgress',
          error: null,
        },
      }),
    error =>
      error instanceof Error &&
      error.message === 'turn completed event.turn.status must be completed, interrupted, or failed.',
  );
});

