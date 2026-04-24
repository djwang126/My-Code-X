import test from 'node:test';
import assert from 'node:assert/strict';

import { createChatMessageService } from './chat-message.service.js';
import { createSessionRegistry } from '../shared/chat-session-registry.js';
import { createChatEventBus } from '../shared/chat-session-event-bus.js';
import { createSessionState } from '../shared/chat-session-state.js';

function createHarness({
  createdThread,
  normalizedContent,
  sendContent,
  displayContent,
}) {
  const calls = [];
  const referencedAttachments = [];
  const now = () => '2026-04-15T10:00:00.000Z';
  const registry = createSessionRegistry();
  const emitter = createChatEventBus();
  const runtime = createSessionState({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    workspace: 'D:/workspaces/My-Code-X',
    threadId: 'thread-1',
    latestTurn: null,
    now,
  });

  const service = createChatMessageService({
    codexGateway: {
      async startTurn(payload) {
        calls.push(payload);
        return { turnId: 'turn-1' };
      },
    },
    now,
    logger: { warn() {} },
    registry,
    emitter,
    sessionService: {
      async getOrCreateRuntimeForSend() {
        return {
          runtime,
          createdThread,
          runtimeSettings: undefined,
        };
      },
    },
    attachmentService: {
      async resolveContent(content) {
        assert.deepEqual(content, normalizedContent);
        return sendContent;
      },
      async createDisplayContent(content) {
        assert.deepEqual(content, normalizedContent);
        return displayContent;
      },
      async markAttachmentsReferenced(input) {
        referencedAttachments.push(input);
      },
    },
  });

  return { calls, referencedAttachments, registry, service };
}

test('sendMessage resolves imageAttachment items to localImage for Codex and stores display-safe content in the optimistic transcript', async () => {
  const normalizedContent = [
    { type: 'text', text: '看看这张报错截图' },
    { type: 'imageAttachment', attachmentId: 'att-1' },
  ];
  const sendContent = [
    { type: 'text', text: '看看这张报错截图' },
    { type: 'localImage', path: 'C:/Users/test/.my-code-x/attachments/2026/04/15/att-1.webp' },
  ];
  const displayContent = [
    { type: 'text', text: '看看这张报错截图' },
    { type: 'image', attachmentId: 'att-1', url: '/api/v2/chat/attachments/att-1/content' },
  ];
  const { calls, referencedAttachments, registry, service } = createHarness({
    createdThread: true,
    normalizedContent,
    sendContent,
    displayContent,
  });

  await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    workspace: 'D:/workspaces/My-Code-X',
    threadId: '',
    content: normalizedContent,
  });

  assert.deepEqual(calls, [
    {
      threadId: 'thread-1',
      workspace: 'D:/workspaces/My-Code-X',
      content: sendContent,
      runtimeSettings: undefined,
      collaborationModeKind: undefined,
    },
  ]);
  assert.deepEqual(referencedAttachments, [
    {
      content: normalizedContent,
      threadId: 'thread-1',
    },
  ]);

  assert.deepEqual(registry.getRuntimeForSelection({ slotId: 'tab-1', threadId: 'thread-1' }).messages, [
    {
      id: 'user:turn-1',
      kind: 'message',
      itemType: 'userMessage',
      role: 'user',
      text: '看看这张报错截图',
      state: 'complete',
      threadId: 'thread-1',
      turnId: 'turn-1',
      content: displayContent,
      raw: {
        type: 'userMessage',
        id: 'user:turn-1',
        content: displayContent,
      },
    },
  ]);
});
