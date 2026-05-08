import test from 'node:test';
import assert from 'node:assert/strict';

import { createChatService } from '../index.js';

test('hydrateSession preserves an explicit workspace in an empty slot session shell', async () => {
  const service = createChatService({
    codexGateway: {
      async startThread() {
        throw new Error('startThread should not be called');
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

  const result = await service.hydrateSession({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    workspace: 'D:/workspaces/My-Code-X',
    threadId: '',
  });

  assert.equal(result.workspace, 'D:/workspaces/My-Code-X');
  assert.equal(result.threadId, '');
});

test('sendMessage starts a thread after an empty hydrateSession created a slot session shell', async () => {
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

  await service.hydrateSession({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    threadId: '',
  });

  const result = await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    threadId: '',
    text: 'hello after hydrate',
  });

  assert.deepEqual(calls, [
    { method: 'startThread' },
    { method: 'startTurn', threadId: 'thread-1', text: 'hello after hydrate' },
  ]);

  assert.deepEqual(result, {
    threadId: 'thread-1',
    turnExecution: {
      activeTurnId: 'turn-1',
      turnLifecycle: 'running',
    },
  });
});

test('sendMessage still starts a new thread from an empty slot session shell after idle shutdown left no active gateway', async () => {
  const calls = [];
  const runtime = {
    generation: 1,
    active: false,
  };
  const service = createChatService({
    codexGateway: {
      getGatewayGeneration() {
        return runtime.generation;
      },
      hasActiveGateway() {
        return runtime.active;
      },
      async startThread() {
        calls.push({ method: 'startThread' });
        runtime.active = true;
        runtime.generation += 1;
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
    now: () => '2026-04-17T12:00:00.000Z',
  });

  await service.hydrateSession({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    workspace: 'D:/workspaces/My-Code-X',
    threadId: '',
  });

  const result = await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    workspace: 'D:/workspaces/My-Code-X',
    threadId: '',
    text: 'hello after idle shutdown',
  });

  assert.deepEqual(calls, [
    { method: 'startThread' },
    { method: 'startTurn', threadId: 'thread-1', text: 'hello after idle shutdown' },
  ]);

  assert.deepEqual(result, {
    threadId: 'thread-1',
    turnExecution: {
      activeTurnId: 'turn-1',
      turnLifecycle: 'running',
    },
  });
});
