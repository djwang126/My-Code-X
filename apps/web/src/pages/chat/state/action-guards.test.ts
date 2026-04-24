import { describe, expect, it } from 'vitest';
import { parseChatTurn } from '@my-code-x/contracts';

import { deriveChatPageGuards } from './action-guards';
import type { ChatPageGuardInput } from './action-guards';
import type {
  ChatPageOperationState,
  ChatPageSessionSnapshot,
} from './page-state-types';

type SessionSnapshotOverrides = Partial<Omit<ChatPageSessionSnapshot, 'latestTurn'>> & {
  latestTurn?: ChatPageSessionSnapshot['latestTurn'];
  turnStatus?: 'idle' | 'inProgress' | 'completed' | 'interrupted' | 'failed';
  turnId?: string;
};

type ChatPageGuardInputOverrides = {
  interactionState?: ChatPageGuardInput['interactionState'];
  session?: SessionSnapshotOverrides;
  operations?: Partial<ChatPageOperationState>;
  draft?: string;
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

function buildOperationState(overrides: Partial<ChatPageOperationState> = {}): ChatPageOperationState {
  return {
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
    ...overrides,
  };
}

function buildInput(overrides: ChatPageGuardInputOverrides = {}): ChatPageGuardInput {
  return {
    interactionState: overrides.interactionState ?? 'ready-idle',
    session: buildSessionSnapshot(overrides.session),
    operations: buildOperationState(overrides.operations),
    draft: overrides.draft ?? 'Ship it',
  };
}

describe('deriveChatPageGuards', () => {
  it('allows send only in ready-idle with workspace and non-whitespace draft', () => {
    const guards = deriveChatPageGuards(buildInput());

    expect(guards.canSend).toBe(true);
  });

  it('blocks send when the draft is only whitespace', () => {
    const guards = deriveChatPageGuards(buildInput({ draft: '   ' }));

    expect(guards.canSend).toBe(false);
  });

  it('blocks send when the active state is still running', () => {
    const guards = deriveChatPageGuards(
      buildInput({
        interactionState: 'ready-idle',
        session: {
          turnStatus: 'inProgress',
        },
      }),
    );

    expect(guards.canSend).toBe(false);
  });

  it('blocks send while the page is restarting, bootstrapping, or awaiting pending requests', () => {
    const restarting = deriveChatPageGuards(
      buildInput({
        interactionState: 'restarting',
        operations: { restart: 'pending' },
      }),
    );
    const bootstrapping = deriveChatPageGuards(
      buildInput({
        interactionState: 'bootstrapping',
        session: { phase: 'loading' },
      }),
    );
    const awaitingRequests = deriveChatPageGuards(
      buildInput({
        interactionState: 'awaiting-requests',
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
      }),
    );

    expect(restarting.canSend).toBe(false);
    expect(bootstrapping.canSend).toBe(false);
    expect(awaitingRequests.canSend).toBe(false);
  });

  it('blocks workspace switching while bootstrapping, auth recovery, and load failure are active', () => {
    const bootstrapping = deriveChatPageGuards(
      buildInput({
        interactionState: 'bootstrapping',
        session: { phase: 'loading' },
      }),
    );
    const authRequired = deriveChatPageGuards(
      buildInput({
        interactionState: 'auth-required',
        session: { phase: 'auth-required' },
      }),
    );
    const loadError = deriveChatPageGuards(
      buildInput({
        interactionState: 'load-error',
        session: { phase: 'error' },
      }),
    );

    expect(bootstrapping.canSwitchWorkspace).toBe(false);
    expect(bootstrapping.workspaceSwitchReason).toBe('Wait for the session to finish loading before switching workspaces.');
    expect(authRequired.canSwitchWorkspace).toBe(false);
    expect(authRequired.workspaceSwitchReason).toBe('Refresh authentication before switching workspaces.');
    expect(loadError.canSwitchWorkspace).toBe(false);
    expect(loadError.workspaceSwitchReason).toBe('Recover the session before switching workspaces.');
  });

  it('blocks normal send and workspace switching while awaiting requests, but still allows restart, explorer, save, and request submission', () => {
    const guards = deriveChatPageGuards(
      buildInput({
        interactionState: 'awaiting-requests',
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
            {
              id: 'req-2',
              method: 'item/tool/requestUserInput',
              kind: 'user_input',
              threadId: 'thread-1',
              turnId: 'turn-1',
              title: 'Need another input',
              prompt: 'choose again',
              submitState: 'idle',
            },
          ],
        },
      }),
    );

    expect(guards.canSend).toBe(false);
    expect(guards.canSwitchWorkspace).toBe(false);
    expect(guards.workspaceSwitchReason).toBe('Complete the pending requests before switching workspaces.');
    expect(guards.canRestart).toBe(true);
    expect(guards.canOpenExplorer).toBe(true);
    expect(guards.canSaveWorkspace).toBe(true);
    expect(guards.canSubmitPendingRequests).toBe(true);
  });

  it('allows interrupt only while running and no interrupt request is pending', () => {
    const runningGuards = deriveChatPageGuards(
      buildInput({
        interactionState: 'running',
        session: { turnStatus: 'inProgress' },
      }),
    );
    const blockedGuards = deriveChatPageGuards(
      buildInput({
        interactionState: 'running',
        session: { turnStatus: 'inProgress' },
        operations: { interrupt: 'pending' },
      }),
    );

    expect(runningGuards.canInterrupt).toBe(true);
    expect(blockedGuards.canInterrupt).toBe(false);
  });

  it('blocks both send and interrupt while the active turn is interrupting', () => {
    const guards = deriveChatPageGuards(
      buildInput({
        interactionState: 'interrupting',
        session: {
          turnStatus: 'inProgress',
        },
      }),
    );

    expect(guards.canSend).toBe(false);
    expect(guards.canInterrupt).toBe(false);
    expect(guards.canRestart).toBe(true);
  });

  it('allows restart during running but blocks normal switching actions', () => {
    const guards = deriveChatPageGuards(
      buildInput({
        interactionState: 'running',
        session: { turnStatus: 'inProgress' },
      }),
    );

    expect(guards.canRestart).toBe(true);
    expect(guards.canSwitchWorkspace).toBe(false);
    expect(guards.workspaceSwitchReason).toBe('Finish the active turn before switching workspaces.');
  });

  it('keeps explorer and workspace save available during running work', () => {
    const guards = deriveChatPageGuards(
      buildInput({
        interactionState: 'running',
        session: { turnStatus: 'inProgress' },
      }),
    );

    expect(guards.canOpenExplorer).toBe(true);
    expect(guards.canSaveWorkspace).toBe(true);
  });

  it('blocks thread-changing actions and thread mutations outside ready-idle', () => {
    const guards = deriveChatPageGuards(
      buildInput({
        interactionState: 'running',
        session: { turnStatus: 'inProgress' },
      }),
    );

    expect(guards.canNewThread).toBe(false);
    expect(guards.canOpenWorkspaceThreads).toBe(false);
    expect(guards.canRollback).toBe(false);
    expect(guards.canCompact).toBe(false);
  });

  it('allows workspace threads and thread mutation actions in ready-idle when a thread exists', () => {
    const guards = deriveChatPageGuards(buildInput());

    expect(guards.canNewThread).toBe(true);
    expect(guards.canOpenWorkspaceThreads).toBe(true);
    expect(guards.canRollback).toBe(true);
    expect(guards.canCompact).toBe(true);
  });

  it('blocks rollback and compact when there is no active thread even if the page is otherwise idle', () => {
    const guards = deriveChatPageGuards(
      buildInput({
        session: {
          threadId: '',
        },
      }),
    );

    expect(guards.canRollback).toBe(false);
    expect(guards.canCompact).toBe(false);
  });

  it('blocks explorer when no workspace exists even if the page is otherwise idle', () => {
    const guards = deriveChatPageGuards(
      buildInput({
        session: {
          workspace: '',
          threadId: '',
        },
      }),
    );

    expect(guards.canOpenExplorer).toBe(false);
    expect(guards.canSend).toBe(false);
  });

  it('blocks pending-request submission once a request response is already in flight', () => {
    const guards = deriveChatPageGuards(
      buildInput({
        interactionState: 'awaiting-requests',
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
              submitState: 'submitting',
            },
          ],
        },
        operations: {
          pendingRequestSubmit: 'pending',
        },
      }),
    );

    expect(guards.canSubmitPendingRequests).toBe(false);
  });

  it('reports restart as the blocking reason while restart is in progress', () => {
    const guards = deriveChatPageGuards(
      buildInput({
        interactionState: 'restarting',
        operations: { restart: 'pending' },
      }),
    );

    expect(guards.canSwitchWorkspace).toBe(false);
    expect(guards.workspaceSwitchReason).toBe('Wait for restart to finish before switching workspaces.');
  });

  it('blocks additional switching actions while a workspace switch is already pending', () => {
    const guards = deriveChatPageGuards(
      buildInput({
        operations: {
          workspaceSwitch: 'pending',
        },
      }),
    );

    expect(guards.canSwitchWorkspace).toBe(false);
    expect(guards.canNewThread).toBe(false);
    expect(guards.workspaceSwitchReason).toBe('Wait for the current workspace switch to finish.');
  });
});
