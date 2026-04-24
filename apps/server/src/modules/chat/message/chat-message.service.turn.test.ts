import test from 'node:test';
import assert from 'node:assert/strict';

import { createChatService } from '../index.js';
import { createUserTimelineMessage } from '../testing/chat-service-test-helpers.js';

test('sendMessage starts a thread and turn for a new slot session with explicit runtime settings and workspace cwd', async () => {
  const calls = [];
  const service = createChatService({
    codexGateway: {
      async startThread({ workspace, runtimeSettings }) {
        calls.push({ method: 'startThread', workspace, runtimeSettings });
        return { threadId: 'thread-1' };
      },
      async resumeThread() {
        throw new Error('resumeThread should not be called');
      },
      async startTurn({ threadId, workspace, text, runtimeSettings, collaborationModeKind }) {
        calls.push({ method: 'startTurn', threadId, workspace, text, runtimeSettings, collaborationModeKind });
        return { turnId: 'turn-1' };
      },
    },
    now: () => '2026-04-03T10:00:00.000Z',
  });

  const result = await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    workspace: 'D:/workspaces/My-Code-X',
    threadId: '',
    text: 'hello codex',
    runtimeSettings: {
      model: 'gpt-5.4',
      reasoningEffort: 'high',
      approvalPolicy: 'on-request',
      sandboxMode: 'workspace-write',
    },
    collaborationModeKind: 'plan',
  });

  assert.deepEqual(calls, [
    {
      method: 'startThread',
      workspace: 'D:/workspaces/My-Code-X',
      runtimeSettings: {
        model: 'gpt-5.4',
        reasoningEffort: 'high',
        approvalPolicy: 'on-request',
        sandboxMode: 'workspace-write',
      },
    },
    {
      method: 'startTurn',
      threadId: 'thread-1',
      workspace: 'D:/workspaces/My-Code-X',
      text: 'hello codex',
      runtimeSettings: {
        model: 'gpt-5.4',
        reasoningEffort: 'high',
        approvalPolicy: 'on-request',
        sandboxMode: 'workspace-write',
      },
      collaborationModeKind: 'plan',
    },
  ]);

  assert.deepEqual(result, {
    threadId: 'thread-1',
    turn: {
      id: 'turn-1',
      status: 'inProgress',
      error: null,
      startedAt: null,
      completedAt: null,
      durationMs: null,
    },
  });

  assert.deepEqual(service.getSessionState({ slotId: 'tab-1', threadId: 'thread-1' }), {
    slotId: 'tab-1',
    viewerId: 'viewer-1',
    workspace: 'D:/workspaces/My-Code-X',
    threadId: 'thread-1',
    latestTurn: {
      id: 'turn-1',
      status: 'inProgress',
      error: null,
      startedAt: null,
      completedAt: null,
      durationMs: null,
    },
    collaborationModeKind: 'plan',
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
    ],
    notices: [],
    pendingRequests: [],
    lastError: null,
    lastUpdatedAt: '2026-04-03T10:00:00.000Z',
  });
});

test('sendMessage rejects switching an existing slot session into a different workspace', async () => {
  const service = createChatService({
    codexGateway: {
      async startThread({ workspace }) {
        return { threadId: workspace === 'D:/workspaces/My-Code-X' ? 'thread-1' : 'thread-2' };
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
    workspace: 'D:/workspaces/My-Code-X',
    threadId: '',
    text: 'hello codex',
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
      workspace: 'D:/workspaces/codex',
      threadId: 'thread-1',
      text: 'wrong workspace',
    }),
    error => error instanceof Error && error.message === 'workspace mismatch for slot session',
  );
});

test('sendMessage reuses the existing thread for the same slot', async () => {
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

  const result = await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    threadId: 'thread-1',
    text: 'second message',
  });

  assert.deepEqual(calls, [
    { method: 'startThread' },
    { method: 'startTurn', threadId: 'thread-1', text: 'first message' },
    { method: 'startTurn', threadId: 'thread-1', text: 'second message' },
  ]);

  assert.deepEqual(result, {
    threadId: 'thread-1',
    turn: {
      id: 'turn-2',
      status: 'inProgress',
      error: null,
      startedAt: null,
      completedAt: null,
      durationMs: null,
    },
  });
});
