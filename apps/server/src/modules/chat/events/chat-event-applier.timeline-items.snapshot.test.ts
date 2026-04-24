import test from 'node:test';
import assert from 'node:assert/strict';

import { createChatService } from '../index.js';
import { createUserTimelineMessage } from '../testing/chat-service-test-helpers.js';

test('generic special item updates are persisted into runtime state and emitted as timeline updates', async () => {
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
      id: 'cmd-1',
      kind: 'special',
      itemType: 'commandExecution',
      text: 'npm test',
      state: 'streaming',
      threadId: 'thread-1',
      turnId: 'turn-1',
      status: 'inProgress',
      raw: {
        type: 'commandExecution',
        id: 'cmd-1',
        command: 'npm test',
        status: 'inProgress',
      },
    },
  });

  assert.deepEqual(service.getSessionState({ slotId: 'tab-1', threadId: 'thread-1' })?.messages, [
    createUserTimelineMessage({
      threadId: 'thread-1',
      turnId: 'turn-1',
      text: 'run checks',
    }),
    {
      id: 'cmd-1',
      kind: 'special',
      itemType: 'commandExecution',
      text: 'npm test',
      state: 'streaming',
      threadId: 'thread-1',
      turnId: 'turn-1',
      status: 'inProgress',
      raw: {
        type: 'commandExecution',
        id: 'cmd-1',
        command: 'npm test',
        status: 'inProgress',
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
        id: 'cmd-1',
        kind: 'special',
        itemType: 'commandExecution',
        text: 'npm test',
        state: 'streaming',
        threadId: 'thread-1',
        turnId: 'turn-1',
        status: 'inProgress',
        raw: {
          type: 'commandExecution',
          id: 'cmd-1',
          command: 'npm test',
          status: 'inProgress',
        },
      },
    },
  ]);
});

test('canonical Codex user message updates reconcile the optimistic user row instead of duplicating it', async () => {
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
    text: 'hello',
  });

  service.applyGatewayEvent({
    type: 'timeline_item_updated',
    threadId: 'thread-1',
    turnId: 'turn-1',
    item: {
      id: 'canonical-user-1',
      kind: 'message',
      itemType: 'userMessage',
      role: 'user',
      text: 'hello',
      state: 'complete',
      threadId: 'thread-1',
      turnId: 'turn-1',
      content: [{ type: 'text', text: 'hello', text_elements: [] }],
      raw: {
        type: 'userMessage',
        id: 'canonical-user-1',
        content: [{ type: 'text', text: 'hello', text_elements: [] }],
      },
    },
  });

  assert.deepEqual(service.getSessionState({ slotId: 'tab-1', threadId: 'thread-1' })?.messages, [
    {
      id: 'user:turn-1',
      kind: 'message',
      itemType: 'userMessage',
      role: 'user',
      text: 'hello',
      state: 'complete',
      threadId: 'thread-1',
      turnId: 'turn-1',
      content: [{ type: 'text', text: 'hello', text_elements: [] }],
      raw: {
        type: 'userMessage',
        id: 'canonical-user-1',
        content: [{ type: 'text', text: 'hello', text_elements: [] }],
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
        id: 'user:turn-1',
        kind: 'message',
        itemType: 'userMessage',
        role: 'user',
        text: 'hello',
        state: 'complete',
        threadId: 'thread-1',
        turnId: 'turn-1',
        content: [{ type: 'text', text: 'hello', text_elements: [] }],
        raw: {
          type: 'userMessage',
          id: 'canonical-user-1',
          content: [{ type: 'text', text: 'hello', text_elements: [] }],
        },
      },
    },
  ]);
});

test('mid-turn live user message updates keep later same-turn inputs distinct', async () => {
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
    text: 'hello',
  });

  service.applyGatewayEvent({
    type: 'timeline_item_updated',
    threadId: 'thread-1',
    turnId: 'turn-1',
    item: {
      id: 'canonical-user-1',
      kind: 'message',
      itemType: 'userMessage',
      role: 'user',
      text: 'hello',
      state: 'complete',
      threadId: 'thread-1',
      turnId: 'turn-1',
      content: [{ type: 'text', text: 'hello', text_elements: [] }],
      raw: {
        type: 'userMessage',
        id: 'canonical-user-1',
        content: [{ type: 'text', text: 'hello', text_elements: [] }],
      },
    },
  });

  service.applyGatewayEvent({
    type: 'timeline_item_updated',
    threadId: 'thread-1',
    turnId: 'turn-1',
    item: {
      id: 'steer-raw',
      kind: 'message',
      itemType: 'userMessage',
      role: 'user',
      text: 'keep going',
      state: 'complete',
      threadId: 'thread-1',
      turnId: 'turn-1',
      content: [{ type: 'text', text: 'keep going', text_elements: [] }],
      raw: {
        type: 'userMessage',
        id: 'steer-raw',
        content: [{ type: 'text', text: 'keep going', text_elements: [] }],
      },
    },
  });

  assert.deepEqual(service.getSessionState({ slotId: 'tab-1', threadId: 'thread-1' })?.messages, [
    {
      id: 'user:turn-1',
      kind: 'message',
      itemType: 'userMessage',
      role: 'user',
      text: 'hello',
      state: 'complete',
      threadId: 'thread-1',
      turnId: 'turn-1',
      content: [{ type: 'text', text: 'hello', text_elements: [] }],
      raw: {
        type: 'userMessage',
        id: 'canonical-user-1',
        content: [{ type: 'text', text: 'hello', text_elements: [] }],
      },
    },
    {
      id: 'user:turn-1:u2',
      kind: 'message',
      itemType: 'userMessage',
      role: 'user',
      text: 'keep going',
      state: 'complete',
      threadId: 'thread-1',
      turnId: 'turn-1',
      content: [{ type: 'text', text: 'keep going', text_elements: [] }],
      raw: {
        type: 'userMessage',
        id: 'steer-raw',
        content: [{ type: 'text', text: 'keep going', text_elements: [] }],
      },
    },
  ]);

  assert.deepEqual(events.at(-1), {
    type: 'timeline_item_updated',
    threadId: 'thread-1',
    turnId: 'turn-1',
    item: {
      id: 'user:turn-1:u2',
      kind: 'message',
      itemType: 'userMessage',
      role: 'user',
      text: 'keep going',
      state: 'complete',
      threadId: 'thread-1',
      turnId: 'turn-1',
      content: [{ type: 'text', text: 'keep going', text_elements: [] }],
      raw: {
        type: 'userMessage',
        id: 'steer-raw',
        content: [{ type: 'text', text: 'keep going', text_elements: [] }],
      },
    },
  });
});

