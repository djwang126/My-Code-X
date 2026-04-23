import { beforeEach, describe, expect, it } from 'vitest';

import { chatRuntimeReducer } from './state/chat-runtime-reducer';
import { createInitialChatRuntimeState } from './state/chat-runtime-state';
import { readRuntimeSettings } from '../settings';
import { setActiveWorkspacePath, synchronizeStoredThreadId } from '../../session';
import type { SessionPayload } from './session-types';

const runtimePreferences: SessionPayload['preferences'] = {
  model: 'gpt-5.4',
  reasoningEffort: 'medium',
  approvalPolicy: 'never',
  sandboxMode: 'danger-full-access',
  collaborationModeKind: 'default',
  promptOverride: 'cat',
};

const bootstrapPayload = {
  server: { ok: true, serverInstanceId: 'hydrate-test', authRequired: false },
  viewer: { viewerId: 'viewer-3', slotId: 'tab-9' },
  session: {
    workspace: 'D:/workspaces/sample',
    threadId: 'thread-1',
    turnExecution: {
      activeTurnId: 'turn-1',
      turnLifecycle: 'running',
    },
    lastUpdatedAt: '2026-04-03T12:34:56.000Z',
    threadName: '',
    threadStatusText: '',
    tokenUsageText: '',
  },
  conversation: {
    messages: [
      {
        id: 'user:turn-1',
        kind: 'message',
        itemType: 'userMessage',
        role: 'user',
        text: 'hello',
        state: 'complete',
        threadId: 'thread-1',
        turnId: 'turn-1',
      },
      {
        id: 'assistant:1',
        kind: 'message',
        itemType: 'agentMessage',
        role: 'assistant',
        text: 'still thinking',
        state: 'streaming',
        threadId: 'thread-1',
        turnId: 'turn-1',
      },
    ],
  },
  stream: {
    url: '/api/v2/chat/events?slotId=tab-9&threadId=thread-1',
  },
  preferences: runtimePreferences,
  options: {},
  notices: [],
} satisfies SessionPayload;

describe('chat runtime reducer bootstrap', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('creates an empty runtime state seeded by the current bootstrap scope', () => {
    setActiveWorkspacePath('slot-bootstrap', 'D:/workspaces/sample');
    synchronizeStoredThreadId('slot-bootstrap', 'thread-1');
    window.history.replaceState({}, '', '/?slot=slot-bootstrap');

    const initialState = createInitialChatRuntimeState();

    expect(initialState).toMatchObject({
      workspace: 'D:/workspaces/sample',
      threadId: 'thread-1',
      turnExecution: {
        activeTurnId: null,
        turnLifecycle: 'idle',
      },
      threadName: '',
      threadStatus: null,
      threadStatusText: '',
      tokenUsageText: '',
      statusMessage: 'Session synced',
      errorMessage: '',
      errorDetail: null,
      messages: [],
      notices: [],
      pendingRequests: [],
      streamUrl: '',
      streamRevision: 0,
      preferences: {},
      options: {},
    });
  });

  it('hydrates runtime state from a bootstrap payload', () => {
    const state = createInitialChatRuntimeState();
    const next = chatRuntimeReducer(state, {
      type: 'bootstrap/succeeded',
      payload: bootstrapPayload,
    });

    expect(next.workspace).toBe('D:/workspaces/sample');
    expect(next.threadId).toBe('thread-1');
    expect(next.turnExecution.activeTurnId).toBe('turn-1');
    expect(next.turnExecution.turnLifecycle).toBe('running');
    expect(readRuntimeSettings(next.preferences)?.collaborationModeKind).toBe('default');
    expect(next.messages).toEqual(bootstrapPayload.conversation.messages);
    expect(next.streamUrl).toBe('/api/v2/chat/events?slotId=tab-9&threadId=thread-1');
  });

  it('keeps collaboration mode unset when bootstrap payload reports none', () => {
    const next = chatRuntimeReducer(createInitialChatRuntimeState(), {
      type: 'bootstrap/succeeded',
      payload: {
        ...bootstrapPayload,
        preferences: {
          ...runtimePreferences,
          collaborationModeKind: null,
        },
        session: {
          ...bootstrapPayload.session,
          collaborationModeKind: null,
        },
      },
    });

    expect(readRuntimeSettings(next.preferences)?.collaborationModeKind).toBeNull();
  });

  it('treats thread prompt override metadata as authoritative over stored preferences in the bootstrap payload', () => {
    const next = chatRuntimeReducer(createInitialChatRuntimeState(), {
      type: 'bootstrap/succeeded',
      payload: {
        ...bootstrapPayload,
        session: {
          ...bootstrapPayload.session,
          promptOverride: 'normal',
        },
        preferences: {
          ...runtimePreferences,
          promptOverride: 'cat',
        },
      },
    });

    expect(readRuntimeSettings(next.preferences)?.promptOverride).toBe('normal');
  });

  it('clears a stale stored prompt override when bootstrap metadata says the resumed thread uses none', () => {
    const next = chatRuntimeReducer(createInitialChatRuntimeState(), {
      type: 'bootstrap/succeeded',
      payload: {
        ...bootstrapPayload,
        session: {
          ...bootstrapPayload.session,
          promptOverride: null,
        },
        preferences: {
          ...runtimePreferences,
          promptOverride: 'cat',
        },
      },
    });

    expect(readRuntimeSettings(next.preferences)?.promptOverride).toBeNull();
  });

  it('clears derived runtime fields when bootstrap resets to a different thread', () => {
    const next = chatRuntimeReducer(
      chatRuntimeReducer(createInitialChatRuntimeState(), {
        type: 'bootstrap/succeeded',
        payload: bootstrapPayload,
      }),
      {
        type: 'bootstrap/reset',
        workspace: 'D:/workspaces/other',
        threadId: 'thread-2',
      },
    );

    expect(next).toMatchObject({
      workspace: 'D:/workspaces/other',
      threadId: 'thread-2',
      turnExecution: {
        activeTurnId: null,
        turnLifecycle: 'idle',
      },
      threadName: '',
      threadStatusText: '',
      tokenUsageText: '',
      statusMessage: 'Loading session…',
      errorMessage: '',
      messages: [],
      notices: [],
      streamUrl: '',
      preferences: {},
      options: {},
    });
  });

  it('keeps a completed cached transcript visible while reloading the same thread', () => {
    const completedState = chatRuntimeReducer(createInitialChatRuntimeState(), {
      type: 'bootstrap/succeeded',
      payload: {
        ...bootstrapPayload,
        session: {
          ...bootstrapPayload.session,
          turnExecution: {
            ...bootstrapPayload.session.turnExecution,
            turnLifecycle: 'completed',
          },
          threadName: 'Cached thread',
        },
      },
    });

    const next = chatRuntimeReducer(completedState, {
      type: 'bootstrap/reset',
      workspace: 'D:/workspaces/sample',
      threadId: 'thread-1',
    });

    expect(next).toMatchObject({
      workspace: 'D:/workspaces/sample',
      threadId: 'thread-1',
      turnExecution: expect.objectContaining({
        turnLifecycle: 'completed',
      }),
      threadName: 'Cached thread',
      messages: bootstrapPayload.conversation.messages,
      statusMessage: 'Loading session…',
    });
  });
});
