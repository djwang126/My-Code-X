import test from 'node:test';
import assert from 'node:assert/strict';

import { createChatService } from '../index.js';

test('session meta and notice events persist across runtime snapshots and subscriber updates', async () => {
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
    type: 'session_meta_updated',
    threadId: 'thread-1',
    threadName: 'Issue 9 work',
    threadStatus: { type: 'systemError' },
    threadStatusText: 'archived',
    tokenUsageText: 'input: 120 · output: 45 · total: 165',
  });

  service.applyGatewayEvent({
    type: 'system_notice',
    threadId: 'thread-1',
    notice: {
      id: 'configWarning:latest',
      level: 'warning',
      title: 'Config warning',
      text: 'Sandbox will be tightened soon',
      raw: {
        message: 'Sandbox will be tightened soon',
      },
    },
  });

  assert.deepEqual(service.getSessionState({ slotId: 'tab-1', threadId: 'thread-1' })?.threadName, 'Issue 9 work');
  assert.deepEqual(service.getSessionState({ slotId: 'tab-1', threadId: 'thread-1' })?.threadStatusText, 'archived');
  assert.deepEqual(
    service.getSessionState({ slotId: 'tab-1', threadId: 'thread-1' })?.tokenUsageText,
    'input: 120 · output: 45 · total: 165',
  );
  assert.deepEqual(service.getSessionState({ slotId: 'tab-1', threadId: 'thread-1' })?.notices, [
    {
      id: 'configWarning:latest',
      level: 'warning',
      title: 'Config warning',
      text: 'Sandbox will be tightened soon',
      raw: {
        message: 'Sandbox will be tightened soon',
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
      type: 'session_meta_updated',
      threadId: 'thread-1',
      threadName: 'Issue 9 work',
      threadStatus: { type: 'systemError' },
      threadStatusText: 'archived',
      tokenUsageText: 'input: 120 · output: 45 · total: 165',
    },
    {
      type: 'system_notice',
      threadId: 'thread-1',
      notice: {
        id: 'configWarning:latest',
        level: 'warning',
        title: 'Config warning',
        text: 'Sandbox will be tightened soon',
        raw: {
          message: 'Sandbox will be tightened soon',
        },
      },
    },
  ]);
});

test('unsubscribe stops future runtime events for that subscriber', async () => {
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

  unsubscribe();

  service.applyGatewayEvent({
    type: 'agent_message_delta',
    threadId: 'thread-1',
    turnId: 'turn-1',
    itemId: 'assistant:turn-1',
    delta: 'should not arrive',
  });

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
  ]);
});

