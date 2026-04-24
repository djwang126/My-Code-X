import { describe, expect, it } from 'vitest';
import { parseChatTurn } from '@my-code-x/contracts';

import { buildChatPageViewModel } from './view-model';
import type {
  ChatPageError,
  ChatPageOperationState,
  ChatPageSessionSnapshot,
} from './page-state-types';

type SessionSnapshotOverrides = Partial<Omit<ChatPageSessionSnapshot, 'latestTurn'>> & {
  latestTurn?: ChatPageSessionSnapshot['latestTurn'];
  turnStatus?: 'idle' | 'inProgress' | 'completed' | 'interrupted' | 'failed';
  turnId?: string;
};

type ViewModelOverrides = {
  currentError?: ChatPageError | null;
  draft?: string;
  operations?: Partial<ChatPageOperationState>;
  session?: SessionSnapshotOverrides;
};

function buildInput(overrides: ViewModelOverrides = {}) {
  const {
    turnId,
    latestTurn,
    turnStatus = 'idle',
    ...sessionOverrides
  } = overrides.session ?? {};
  const session = {
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
    ...sessionOverrides,
  } as ChatPageSessionSnapshot;
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
    currentError: overrides.currentError ?? null,
    draft: overrides.draft ?? 'Ship it',
    operations,
    session,
  };
}

describe('buildChatPageViewModel', () => {
  it('maps ready-idle into enabled input and send button behavior', () => {
    const viewModel = buildChatPageViewModel(buildInput());

    expect(viewModel.interactionState).toBe('ready-idle');
    expect(viewModel.actionBlocked).toBe(false);
    expect(viewModel.hasWorkspace).toBe(true);
    expect(viewModel.hasThread).toBe(true);
    expect(viewModel.hasPendingRequests).toBe(false);
    expect(viewModel.inputDisabled).toBe(false);
    expect(viewModel.sendButtonDisabled).toBe(false);
    expect(viewModel.guards.canSend).toBe(true);
  });

  it('maps running into blocked send while preserving interrupt availability through guards', () => {
    const viewModel = buildChatPageViewModel(
      buildInput({
        draft: 'Still queued',
        session: {
          turnStatus: 'inProgress',
        },
      }),
    );

    expect(viewModel.interactionState).toBe('running');
    expect(viewModel.actionBlocked).toBe(true);
    expect(viewModel.inputDisabled).toBe(true);
    expect(viewModel.sendButtonDisabled).toBe(false);
    expect(viewModel.guards.canInterrupt).toBe(true);
    expect(viewModel.guards.canSend).toBe(false);
  });

  it('maps interrupting into blocked input and a disabled primary action while stop is still settling', () => {
    const viewModel = buildChatPageViewModel(
      buildInput({
        session: {
          turnStatus: 'inProgress',
        },
        operations: { interrupt: 'pending' },
      }),
    );

    expect(viewModel.interactionState).toBe('interrupting');
    expect(viewModel.inputDisabled).toBe(true);
    expect(viewModel.sendButtonDisabled).toBe(true);
    expect(viewModel.guards.canInterrupt).toBe(false);
    expect(viewModel.guards.canSend).toBe(false);
  });

  it('maps awaiting-requests into blocked input and workspace switching with request submission enabled', () => {
    const viewModel = buildChatPageViewModel(
      buildInput({
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
              prompt: 'Choose one',
              submitState: 'idle',
            },
          ],
        },
      }),
    );

    expect(viewModel.interactionState).toBe('awaiting-requests');
    expect(viewModel.hasPendingRequests).toBe(true);
    expect(viewModel.pendingRequestCount).toBe(1);
    expect(viewModel.actionBlocked).toBe(true);
    expect(viewModel.inputDisabled).toBe(true);
    expect(viewModel.sendButtonDisabled).toBe(true);
    expect(viewModel.guards.canSubmitPendingRequests).toBe(true);
    expect(viewModel.guards.canSwitchWorkspace).toBe(false);
    expect(viewModel.guards.workspaceSwitchReason).toBe('Complete the pending requests before switching workspaces.');
  });

  it('maps restarting into blocked input and blocked send button even with a non-empty draft', () => {
    const viewModel = buildChatPageViewModel(
      buildInput({
        operations: {
          restart: 'pending',
        },
      }),
    );

    expect(viewModel.interactionState).toBe('restarting');
    expect(viewModel.actionBlocked).toBe(true);
    expect(viewModel.inputDisabled).toBe(true);
    expect(viewModel.sendButtonDisabled).toBe(true);
    expect(viewModel.guards.canRestart).toBe(false);
  });

  it('keeps the composer editable while disabling send validation through guards when the draft is empty', () => {
    const viewModel = buildChatPageViewModel(
      buildInput({
        draft: '',
      }),
    );

    expect(viewModel.interactionState).toBe('ready-idle');
    expect(viewModel.inputDisabled).toBe(false);
    expect(viewModel.sendButtonDisabled).toBe(false);
    expect(viewModel.guards.canSend).toBe(false);
  });

  it('preserves the typed currentError payload in the returned view model', () => {
    const viewModel = buildChatPageViewModel(
      buildInput({
        currentError: {
          kind: 'workspace-file-save',
          message: 'Save failed',
        },
      }),
    );

    expect(viewModel.currentError).toEqual({
      kind: 'workspace-file-save',
      message: 'Save failed',
    });
  });

  it('derives ready-idle sendability from state instead of stale transport flags', () => {
    const viewModel = buildChatPageViewModel(
      buildInput({
        session: {
          turnStatus: 'completed',
        },
      }),
    );

    expect(viewModel.interactionState).toBe('ready-idle');
    expect(viewModel.guards.canSend).toBe(true);
  });
});

