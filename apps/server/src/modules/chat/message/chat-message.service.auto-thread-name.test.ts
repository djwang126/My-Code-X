import test from 'node:test';
import assert from 'node:assert/strict';

import { createChatService } from '../index.js';
import { createLogger } from '../testing/chat-service-test-helpers.js';

test('sendMessage auto-names a newly created thread from the first prompt and emits session meta immediately', async () => {
  const calls = [];
  const events = [];
  const service = createChatService({
    codexGateway: {
      async startThread() {
        calls.push({ method: 'startThread' });
        return { threadId: 'thread-1' };
      },
      async resumeThread() {
        throw new Error('resumeThread should not be called');
      },
      async startTurn({ threadId, text }) {
        calls.push({ method: 'startTurn', threadId, text });
        return { turnId: 'turn-1' };
      },
      async setThreadName({ threadId, name }) {
        calls.push({ method: 'setThreadName', threadId, name });
        return { ok: true, threadId, name };
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
    text: '这是一个很长很长很长很长的标题测试，用来验证自动截断能力',
  });

  assert.deepEqual(calls, [
    { method: 'startThread' },
    { method: 'startTurn', threadId: 'thread-1', text: '这是一个很长很长很长很长的标题测试，用来验证自动截断能力' },
    { method: 'setThreadName', threadId: 'thread-1', name: '这是一个很长很长很长很长的标题…' },
  ]);
  assert.equal(service.getSessionState({ slotId: 'tab-1', threadId: 'thread-1' })?.threadName, '这是一个很长很长很长很长的标题…');
  assert.deepEqual(
    events.map(event => event.type),
    ['session_meta_updated', 'turn_started'],
  );
  assert.deepEqual(events[0], {
    type: 'session_meta_updated',
    threadId: 'thread-1',
    threadName: '这是一个很长很长很长很长的标题…',
    threadStatus: null,
    threadStatusText: '',
    tokenUsageText: '',
  });
});

test('sendMessage does not auto-name resumed threads or overwrite an existing thread name', async () => {
  const calls = [];
  const service = createChatService({
    codexGateway: {
      async startThread() {
        calls.push({ method: 'startThread' });
        return { threadId: 'thread-1' };
      },
      async resumeThread({ threadId }) {
        calls.push({ method: 'resumeThread', threadId });
        return {
          threadId,
          latestTurn: null,
          threadName: 'Existing title',
          messages: [],
        };
      },
      async startTurn({ threadId, text }) {
        calls.push({ method: 'startTurn', threadId, text });
        return { turnId: `turn-${calls.filter(call => call.method === 'startTurn').length}` };
      },
      async setThreadName({ threadId, name }) {
        calls.push({ method: 'setThreadName', threadId, name });
        return { ok: true, threadId, name };
      },
    },
    now: () => '2026-04-03T10:00:00.000Z',
  });

  await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    threadId: '',
    text: 'first prompt',
  });

  service.applyGatewayEvent({
    type: 'turn_completed',
    threadId: 'thread-1',
    turn: { id: 'turn-1', status: 'completed', error: null },
  });

  await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'tab-2',
    threadId: 'thread-9',
    text: 'resumed prompt',
  });

  assert.deepEqual(calls, [
    { method: 'startThread' },
    { method: 'startTurn', threadId: 'thread-1', text: 'first prompt' },
    { method: 'setThreadName', threadId: 'thread-1', name: 'first prompt' },
    { method: 'resumeThread', threadId: 'thread-9' },
    { method: 'startTurn', threadId: 'thread-9', text: 'resumed prompt' },
  ]);
});

test('sendMessage keeps the turn flowing when auto-naming fails and logs through the injected logger', async () => {
  const { logger, warnings } = createLogger();
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
      async setThreadName() {
        throw new Error('rename failed');
      },
    },
    now: () => '2026-04-03T10:00:00.000Z',
    logger,
  });

  const result = await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    threadId: '',
    text: 'first prompt',
  });

  assert.deepEqual(result, {
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
  assert.equal(service.getSessionState({ slotId: 'tab-1', threadId: 'thread-1' })?.threadName, '');
  assert.deepEqual(warnings, ['[chat-runtime-service] failed to auto-name chat thread thread-1: rename failed']);
});

test('sendMessage skips auto-naming when the gateway does not support thread naming', async () => {
  const calls = [];
  const service = createChatService({
    codexGateway: {
      async startThread() {
        calls.push({ method: 'startThread' });
        return { threadId: 'thread-1' };
      },
      async resumeThread() {
        throw new Error('resumeThread should not be called');
      },
      async startTurn({ threadId, text }) {
        calls.push({ method: 'startTurn', threadId, text });
        return { turnId: 'turn-1' };
      },
    },
    now: () => '2026-04-03T10:00:00.000Z',
  });

  await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    threadId: '',
    text: 'first prompt',
  });

  assert.deepEqual(calls, [
    { method: 'startThread' },
    { method: 'startTurn', threadId: 'thread-1', text: 'first prompt' },
  ]);
  assert.equal(service.getSessionState({ slotId: 'tab-1', threadId: 'thread-1' })?.threadName, '');
});
