import { useMemo } from 'react';

import type { ChatPageRuntimeState } from '../types';
import { buildChatPageViewModel } from '../state/view-model';
import type { ChatPageError, ChatPageOperationState, ChatPageSessionSnapshot } from '../state/page-state-types';

export function useChatPageSessionSnapshot(state: ChatPageRuntimeState) {
  const baseSessionSnapshot = useMemo<ChatPageSessionSnapshot>(
    () => ({
      phase: state.phase,
      workspace: state.workspace,
      threadId: state.threadId,
      turnExecution: state.turnExecution,
      pendingRequests: state.pendingRequests,
    }),
    [state.pendingRequests, state.phase, state.threadId, state.turnExecution, state.workspace],
  );

  const baseInteractionState = useMemo(
    () =>
      buildChatPageViewModel({
        currentError: null,
        draft: '',
        operations: {
          bootstrap: state.phase === 'loading' ? 'pending' : 'idle',
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
        },
        session: baseSessionSnapshot,
      }).interactionState,
    [baseSessionSnapshot, state.phase],
  );

  return {
    baseSessionSnapshot,
    baseInteractionState,
  };
}

type UseChatPageRuntimeViewModelInput = {
  currentError: ChatPageError | null;
  operations: ChatPageOperationState;
  session: ChatPageSessionSnapshot;
};

export function useChatPageRuntimeViewModel({
  currentError,
  operations,
  session,
}: UseChatPageRuntimeViewModelInput) {
  const runtimeViewModel = useMemo(
    () =>
      buildChatPageViewModel({
        currentError,
        draft: '',
        operations,
        session,
      }),
    [currentError, operations, session],
  );

  return {
    runtimeViewModel,
    workspaceSwitchReason: runtimeViewModel.guards.workspaceSwitchReason ?? '',
  };
}
