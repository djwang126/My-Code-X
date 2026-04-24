import { describe, expect, it } from 'vitest';
import { parseChatTurn } from '@my-code-x/contracts';

import { deriveChatInteractionState } from './interaction-state';
import type {
  ChatPageOperationState,
  ChatPageSessionSnapshot,
  ChatPageStateSnapshot,
} from './page-state-types';
import { createInitialChatPageUiState } from './ui-reducer';

type SessionSnapshotOverrides = Partial<Omit<ChatPageSessionSnapshot, 'latestTurn'>> & {
  latestTurn?: ChatPageSessionSnapshot['latestTurn'];
  turnStatus?: 'idle' | 'inProgress' | 'completed' | 'interrupted' | 'failed';
  turnId?: string;
};

type ChatPageStateSnapshotOverrides = {
  session?: SessionSnapshotOverrides;
  operations?: Partial<ChatPageOperationState>;
  currentError?: ChatPageStateSnapshot['currentError'];
};

function buildSessionSnapshot(overrides: SessionSnapshotOverrides = {}): ChatPageSessionSnapshot {
  const {
    turnId,
    latestTurn,
    turnStatus = 'idle',
    ...rest
  } = overrides;

  return {
    phase: 'ready',
    workspace: 'D:/workspaces/my-code-x',
    threadId: 'thread-1',
    latestTurn:
      latestTurn ??
      turnStatus === 'idle'
        ? null
        : parseChatTurn({
            id: turnId ?? 'turn-1',
            status: turnStatus,
            error: null,
            startedAt: null,
            completedAt: null,
            durationMs: null,
          }),
    pendingRequests: [],
    ...rest,
  };
}

function buildState(overrides: ChatPageStateSnapshotOverrides = {}): ChatPageStateSnapshot {
  const operations = {
    bootstrap: 'idle',
    send: 'idle',
    interrupt: 'idle',
    restart: 'idle',
    workspaceThreadsLoad: 'idle',
    workspaceSwitch: 'idle',
    pendingRequestSubmit: 'idle',
    workspaceFileOpen: 'idle',
    workspaceFileSave: 'idle',
    rollback: 'idle',
    compact: 'idle',
    reviewStart: 'idle',
    ...overrides.operations,
  } as ChatPageOperationState;

  return {
    session: buildSessionSnapshot(overrides.session),
    ui: createInitialChatPageUiState(),
    operations,
    currentError: overrides.currentError ?? null,
  };
}

describe('deriveChatInteractionState', () => {
  it('reports bootstrapping whenever the session is not yet ready and no higher-priority blocking state applies', () => {
    const state = buildState({
      session: { phase: 'loading' },
    });

    expect(deriveChatInteractionState(state)).toBe('bootstrapping');
  });

  it('prefers auth-required over other interactive states', () => {
    const state = buildState({
      session: {
        phase: 'auth-required',
        pendingRequests: [
          {
            id: 'req-1',
            method: 'account/chatgptAuthTokens/refresh',
            kind: 'auth_refresh',
            threadId: '',
            turnId: null,
            title: 'Refresh',
            prompt: 'refresh',
            submitState: 'idle',
          },
        ],
      },
      operations: { restart: 'pending' },
    });

    expect(deriveChatInteractionState(state)).toBe('auth-required');
  });

  it('reports load-error when bootstrap failed', () => {
    const state = buildState({
      session: { phase: 'error' },
      operations: { restart: 'pending' },
    });

    expect(deriveChatInteractionState(state)).toBe('load-error');
  });

  it('treats restart as overriding ordinary ready and running states', () => {
    const state = buildState({
      session: { turnStatus: 'inProgress' },
      operations: { restart: 'pending' },
    });

    expect(deriveChatInteractionState(state)).toBe('restarting');
  });

  it('treats unresolved pending requests as awaiting-requests instead of running', () => {
    const state = buildState({
      session: {
        turnStatus: 'inProgress',
        pendingRequests: [
          {
            id: 'req-1',
            method: 'item/tool/requestUserInput',
            kind: 'user_input',
            threadId: 'thread-1',
            turnId: 'turn-1',
            title: 'Need input',
            prompt: 'choose one',
            submitState: 'idle',
          },
        ],
      },
    });

    expect(deriveChatInteractionState(state)).toBe('awaiting-requests');
  });

  it('reports interrupting as its own interaction state while the active turn is stopping', () => {
    const state = buildState({
      session: {
        turnStatus: 'inProgress',
      },
      operations: { interrupt: 'pending' },
    });

    expect(deriveChatInteractionState(state)).toBe('interrupting');
  });

  it('treats pending thread actions as their own interaction state', () => {
    const state = buildState({
      session: {
        threadAction: {
          status: 'resuming-thread',
          threadId: 'thread-1',
        },
      },
    });

    expect(deriveChatInteractionState(state)).toBe('thread-action-pending');
  });

  it('treats send-in-flight as running even before stream metadata catches up', () => {
    const state = buildState({
      session: { turnStatus: 'inProgress' },
      operations: { send: 'pending' },
    });

    expect(deriveChatInteractionState(state)).toBe('running');
  });

  it('treats a ready session with running state as running', () => {
    const state = buildState({
      session: { turnStatus: 'inProgress' },
    });

    expect(deriveChatInteractionState(state)).toBe('running');
  });

  it('falls back to ready-idle when the session is ready and no blocking conditions apply', () => {
    expect(deriveChatInteractionState(buildState())).toBe('ready-idle');
  });
});
