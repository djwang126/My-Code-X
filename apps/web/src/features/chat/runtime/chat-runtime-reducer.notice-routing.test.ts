import { describe, expect, it } from 'vitest';

import { bootstrapPayload } from './test/chatRuntimeReducerHarness';
import { chatRuntimeReducer } from './state/chat-runtime-reducer';
import { createInitialChatRuntimeState } from './state/chat-runtime-state';

describe('chatRuntimeReducer notice routing', () => {
  it('preserves the active thread id for threadless hardening stream events', () => {
    const hydrated = chatRuntimeReducer(createInitialChatRuntimeState(), {
      type: 'bootstrap/succeeded',
      payload: {
        ...bootstrapPayload,
        pendingRequests: [
          {
            id: 'req-auth',
            method: 'account/chatgptAuthTokens/refresh',
            kind: 'auth_refresh',
            threadId: '',
            turnId: null,
            title: 'Refresh ChatGPT authentication',
            prompt: 'Codex needs refreshed ChatGPT credentials.',
            submitState: 'idle',
          },
        ],
      },
    });

    const withPendingRequest = chatRuntimeReducer(hydrated, {
      type: 'stream/pending-request-updated',
      payload: {
        threadId: '',
        request: {
          id: 'req-auth',
          method: 'account/chatgptAuthTokens/refresh',
          kind: 'auth_refresh',
          threadId: '',
          turnId: null,
          title: 'Refresh ChatGPT authentication',
          prompt: 'Codex needs refreshed ChatGPT credentials.',
          submitState: 'idle',
        },
      },
    });

    const withNotice = chatRuntimeReducer(withPendingRequest, {
      type: 'stream/system-notice',
      payload: {
        threadId: '',
        notice: {
          id: 'account/updated:latest',
          level: 'info',
          title: 'Account updated',
          text: 'Signed in again',
        },
      },
    });

    const resolved = chatRuntimeReducer(withNotice, {
      type: 'stream/pending-request-resolved',
      payload: {
        threadId: '',
        requestId: 'req-auth',
        notice: {
          id: 'serverRequest/resolved:req-auth',
          level: 'info',
          title: 'Request resolved',
          text: 'Resolved request req-auth',
        },
      },
    });

    expect(withPendingRequest.threadId).toBe('thread-1');
    expect(withNotice.threadId).toBe('thread-1');
    expect(resolved.threadId).toBe('thread-1');
    expect(resolved.pendingRequests).toEqual([]);
    expect(resolved.notices.map(notice => notice.id)).toContain('serverRequest/resolved:req-auth');
  });

  it('keeps pending request updates data-only while later turn messages arrive', () => {
    const hydrated = chatRuntimeReducer(createInitialChatRuntimeState(), {
      type: 'bootstrap/succeeded',
      payload: bootstrapPayload,
    });

    const withPendingRequest = chatRuntimeReducer(hydrated, {
      type: 'stream/pending-request-updated',
      payload: {
        threadId: 'thread-1',
        request: {
          id: 'req-input',
          method: 'item/tool/requestUserInput',
          kind: 'user_input',
          threadId: 'thread-1',
          turnId: 'turn-1',
          itemId: 'ask-missing',
          title: 'Answer 1 question',
          prompt: '',
          questions: [],
          submitState: 'idle',
        },
      },
    });

    expect(withPendingRequest.pendingRequests[0]).toMatchObject({
      id: 'req-input',
      kind: 'user_input',
      itemId: 'ask-missing',
      turnId: 'turn-1',
    });

    const withLaterMessage = chatRuntimeReducer(withPendingRequest, {
      type: 'stream/timeline-item-updated',
      payload: {
        threadId: 'thread-1',
        turnId: 'turn-1',
        item: {
          id: 'assistant:2',
          kind: 'message',
          itemType: 'agentMessage',
          role: 'assistant',
          text: 'later follow-up',
          state: 'streaming',
          threadId: 'thread-1',
          turnId: 'turn-1',
        },
      },
    });

    expect(withLaterMessage.pendingRequests[0]).toMatchObject({
      id: 'req-input',
      kind: 'user_input',
      itemId: 'ask-missing',
      turnId: 'turn-1',
    });

    const withRequestRefresh = chatRuntimeReducer(withLaterMessage, {
      type: 'stream/pending-request-updated',
      payload: {
        threadId: 'thread-1',
        request: {
          id: 'req-input',
          method: 'item/tool/requestUserInput',
          kind: 'user_input',
          threadId: 'thread-1',
          turnId: 'turn-1',
          itemId: 'ask-missing',
          title: 'Answer 1 question',
          prompt: '',
          questions: [],
          submitState: 'idle',
        },
      },
    });

    expect(withRequestRefresh.pendingRequests[0]).toMatchObject({
      id: 'req-input',
      kind: 'user_input',
      itemId: 'ask-missing',
      turnId: 'turn-1',
    });
  });

  it('keeps item-bound pending requests raw even when the item is a special timeline row', () => {
    const hydrated = chatRuntimeReducer(createInitialChatRuntimeState(), {
      type: 'bootstrap/succeeded',
      payload: bootstrapPayload,
    });

    const withSpecialItem = chatRuntimeReducer(hydrated, {
      type: 'stream/timeline-item-updated',
      payload: {
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
          raw: {
            type: 'commandExecution',
            id: 'cmd-1',
            command: 'npm test',
          },
        },
      },
    });

    const withPendingRequest = chatRuntimeReducer(withSpecialItem, {
      type: 'stream/pending-request-updated',
      payload: {
        threadId: 'thread-1',
        request: {
          id: 'req-item-bound',
          method: 'item/commandExecution/requestApproval',
          kind: 'command_approval',
          threadId: 'thread-1',
          turnId: 'turn-1',
          itemId: 'cmd-1',
          title: 'Approve command execution',
          prompt: 'Review the pending command',
          submitState: 'idle',
        },
      },
    });

    expect(withPendingRequest.pendingRequests[0]).toMatchObject({
      id: 'req-item-bound',
      kind: 'command_approval',
      itemId: 'cmd-1',
      turnId: 'turn-1',
    });
  });

  it('stores live session meta and system notice events outside the transcript', () => {
    const hydrated = chatRuntimeReducer(createInitialChatRuntimeState(), {
      type: 'bootstrap/succeeded',
      payload: bootstrapPayload,
    });

    const withMeta = chatRuntimeReducer(hydrated, {
      type: 'stream/session-meta-updated',
      payload: {
        threadId: 'thread-1',
        threadName: 'Issue 9 work',
        threadStatusText: 'archived',
        tokenUsageText: 'input: 120 · output: 45 · total: 165',
      },
    });

    const withNotice = chatRuntimeReducer(withMeta, {
      type: 'stream/system-notice',
      payload: {
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
    });

    expect(withNotice.threadName).toBe('Issue 9 work');
    expect(withNotice.threadStatusText).toBe('archived');
    expect(withNotice.tokenUsageText).toBe('input: 120 · output: 45 · total: 165');
    expect(withNotice.messages).toEqual(hydrated.messages);
    expect(withNotice.notices).toEqual([
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
  });

  it('clears stale session chrome values when an authoritative snapshot sends empty metadata', () => {
    const hydrated = chatRuntimeReducer(createInitialChatRuntimeState(), {
      type: 'bootstrap/succeeded',
      payload: bootstrapPayload,
    });

    const withMeta = chatRuntimeReducer(hydrated, {
      type: 'stream/session-meta-updated',
      payload: {
        threadId: 'thread-1',
        threadName: 'Issue 9 work',
        threadStatusText: 'archived',
        tokenUsageText: 'input: 120 · output: 45 · total: 165',
      },
    });

    const withClearingSnapshot = chatRuntimeReducer(withMeta, {
      type: 'stream/snapshot',
      payload: {
        threadId: 'thread-1',
        latestTurn: {
        id: 'turn-1',
        status: 'completed',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
        messages: bootstrapPayload.conversation.messages,
        threadName: '',
        threadStatusText: '',
        tokenUsageText: '',
        notices: [],
        pendingRequests: [],
      },
    });

    expect(withClearingSnapshot.threadName).toBe('');
    expect(withClearingSnapshot.threadStatusText).toBe('');
    expect(withClearingSnapshot.tokenUsageText).toBe('');
    expect(withClearingSnapshot.statusMessage).toBe(withMeta.statusMessage);
  });

});
