import test from 'node:test';
import assert from 'node:assert/strict';

import { createChatMessageService } from './chat-message.service.js';
import { createSessionRegistry } from '../shared/chat-session-registry.js';
import { createChatEventBus } from '../shared/chat-session-event-bus.js';
import { createSessionState } from '../shared/chat-session-state.js';

test('sendMessage allows image-only content at the public boundary and still hands localImage items to Codex', async () => {
  const calls = [];
  const now = () => '2026-04-15T10:00:00.000Z';
  const registry = createSessionRegistry();
  const emitter = createChatEventBus();
  const referencedAttachments = [];
  const runtime = createSessionState({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    workspace: 'D:/workspaces/My-Code-X',
    threadId: 'thread-1',
    turnExecution: {
      activeTurnId: null,
      turnLifecycle: 'idle',
    },
    now,
  });
  const normalizedContent = [
    { type: 'imageAttachment', attachmentId: 'att-1' },
    { type: 'imageAttachment', attachmentId: 'att-2' },
  ];
  const sendContent = [
    { type: 'localImage', path: 'C:/Users/test/.my-code-x/attachments/2026/04/15/att-1.webp' },
    { type: 'localImage', path: 'C:/Users/test/.my-code-x/attachments/2026/04/15/att-2.webp' },
  ];
  const displayContent = [
    { type: 'image', attachmentId: 'att-1', url: '/api/v2/chat/attachments/att-1/content' },
    { type: 'image', attachmentId: 'att-2', url: '/api/v2/chat/attachments/att-2/content' },
  ];
  const service = createChatMessageService({
    codexGateway: {
      async startTurn(payload) {
        calls.push(payload);
        return { turnId: 'turn-2' };
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
          createdThread: false,
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

  await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    workspace: 'D:/workspaces/My-Code-X',
    threadId: 'thread-1',
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
      id: 'user:turn-2',
      kind: 'message',
      itemType: 'userMessage',
      role: 'user',
      text: '',
      state: 'complete',
      threadId: 'thread-1',
      turnId: 'turn-2',
      content: displayContent,
      raw: {
        type: 'userMessage',
        id: 'user:turn-2',
        content: displayContent,
      },
    },
  ]);
});
