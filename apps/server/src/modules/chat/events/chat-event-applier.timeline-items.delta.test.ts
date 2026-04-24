import test from 'node:test';
import assert from 'node:assert/strict';

import { createChatService } from '../index.js';
import { createUserTimelineMessage } from '../testing/chat-service-test-helpers.js';

test('live special-item deltas reconcile in place and create late rows when needed', async () => {
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

  service.subscribe({ slotId: 'tab-1', threadId: 'thread-1' }, event => {
    events.push(event);
  });

  await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    threadId: '',
    text: 'run checks',
  });

  service.applyGatewayEvent({
    type: 'timeline_item_updated',
    threadId: 'thread-1',
    turnId: 'turn-1',
    item: {
      id: 'plan-1',
      kind: 'special',
      itemType: 'plan',
      text: '',
      state: 'streaming',
      threadId: 'thread-1',
      turnId: 'turn-1',
      raw: {
        type: 'plan',
        id: 'plan-1',
        text: '',
      },
    },
  });

  service.applyGatewayEvent({
    type: 'timeline_item_delta',
    threadId: 'thread-1',
    turnId: 'turn-1',
    itemId: 'plan-1',
    itemType: 'plan',
    delta: 'Inspect reducer state',
  });

  service.applyGatewayEvent({
    type: 'timeline_item_delta',
    threadId: 'thread-1',
    turnId: 'turn-1',
    itemId: 'cmd-1',
    itemType: 'commandExecution',
    delta: 'PASS 42 tests',
    deltaField: 'aggregatedOutput',
  });

  assert.deepEqual(service.getSessionState({ slotId: 'tab-1', threadId: 'thread-1' })?.messages, [
    createUserTimelineMessage({
      threadId: 'thread-1',
      turnId: 'turn-1',
      text: 'run checks',
    }),
    {
      id: 'plan-1',
      kind: 'special',
      itemType: 'plan',
      text: 'Inspect reducer state',
      state: 'streaming',
      threadId: 'thread-1',
      turnId: 'turn-1',
      raw: {
        type: 'plan',
        id: 'plan-1',
        text: 'Inspect reducer state',
      },
    },
    {
      id: 'cmd-1',
      kind: 'special',
      itemType: 'commandExecution',
      text: 'PASS 42 tests',
      state: 'streaming',
      threadId: 'thread-1',
      turnId: 'turn-1',
      raw: {
        type: 'commandExecution',
        id: 'cmd-1',
        aggregatedOutput: 'PASS 42 tests',
      },
    },
  ]);

  assert.deepEqual(events, [
    {
      type: 'turn_started',
      threadId: 'thread-1',
      latestTurn: {
        id: 'turn-1',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
    },
    {
      type: 'timeline_item_updated',
      threadId: 'thread-1',
      turnId: 'turn-1',
      item: {
        id: 'plan-1',
        kind: 'special',
        itemType: 'plan',
        text: '',
        state: 'streaming',
        threadId: 'thread-1',
        turnId: 'turn-1',
        raw: {
          type: 'plan',
          id: 'plan-1',
          text: '',
        },
      },
    },
    {
      type: 'timeline_item_updated',
      threadId: 'thread-1',
      turnId: 'turn-1',
      item: {
        id: 'plan-1',
        kind: 'special',
        itemType: 'plan',
        text: 'Inspect reducer state',
        state: 'streaming',
        threadId: 'thread-1',
        turnId: 'turn-1',
        raw: {
          type: 'plan',
          id: 'plan-1',
          text: 'Inspect reducer state',
        },
      },
    },
    {
      type: 'timeline_item_updated',
      threadId: 'thread-1',
      turnId: 'turn-1',
      item: {
        id: 'cmd-1',
        kind: 'special',
        itemType: 'commandExecution',
        text: 'PASS 42 tests',
        state: 'streaming',
        threadId: 'thread-1',
        turnId: 'turn-1',
        raw: {
          type: 'commandExecution',
          id: 'cmd-1',
          aggregatedOutput: 'PASS 42 tests',
        },
      },
    },
  ]);
});

test('timeline item deltas keep the runtime interrupting after an interrupt has been accepted', async () => {
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
    now: () => '2026-04-03T10:00:00.000Z',
  });

  await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    threadId: '',
    text: 'run checks',
  });
  await service.interruptTurn({
    slotId: 'tab-1',
    threadId: 'thread-1',
  });

  service.applyGatewayEvent({
    type: 'timeline_item_delta',
    threadId: 'thread-1',
    turnId: 'turn-1',
    itemId: 'plan-1',
    itemType: 'plan',
    delta: 'Inspect reducer state',
  });

  const sessionState = service.getSessionState({ slotId: 'tab-1', threadId: 'thread-1' });

  assert.equal(sessionState?.latestTurn?.status, 'interrupting');
  assert.deepEqual(sessionState?.messages.at(-1), {
    id: 'plan-1',
    kind: 'special',
    itemType: 'plan',
    text: 'Inspect reducer state',
    state: 'streaming',
    threadId: 'thread-1',
    turnId: 'turn-1',
    raw: {
      type: 'plan',
      id: 'plan-1',
      text: 'Inspect reducer state',
    },
  });
});

