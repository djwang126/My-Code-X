import { useMemo, useRef } from 'react';

import { selectSessionToastItems } from '../../session-feedback';
import { isProposedPlanActionDismissed } from '../../thread-actions';
import { findProposedPlanActionCandidate } from '../../thread-actions';
import { selectThreadTodoState } from '../../thread-todo';
import { partitionPendingRequests } from '../lib/pending-request-anchors';
import { buildChatPageViewModel } from '../state/chat-page-view-model';
import type { ChatPageProps } from '../types';

export function useChatPageLayoutViewModel(input: ChatPageProps) {
  const pendingRequestAnchorIdsRef = useRef(new Map<string, string>());
  const turnExecution = input.turnExecution;
  const fallbackViewModel = useMemo(
    () =>
      buildChatPageViewModel({
        currentError: input.pageFeedback?.error ?? null,
        draft: '',
        operations: {
          bootstrap: 'idle',
          send: 'idle',
          interrupt: input.interruptPending ? 'pending' : 'idle',
          restart: input.isRestarting ? 'pending' : 'idle',
          threadHistoryLoad: input.threadHistoryLoading ? 'pending' : 'idle',
          workspaceSwitch: input.workspaceSwitchReason ? 'pending' : 'idle',
          pendingRequestSubmit: input.pendingRequests?.some(request => request.submitState === 'submitting') ? 'pending' : 'idle',
          workspaceFileOpen: input.workspaceExplorerLoading ? 'pending' : 'idle',
          workspaceFileSave: input.workspaceFileSaving ? 'pending' : 'idle',
          rollback: 'idle',
          compact: 'idle',
          reviewStart: 'idle',
        },
        session: {
          phase: 'ready',
          workspace: input.workspace,
          threadId: input.threadId,
          turnExecution,
          pendingRequests: input.pendingRequests ?? [],
        },
      }),
    [
      input.interruptPending,
      input.isRestarting,
      input.pageFeedback,
      input.pendingRequests,
      input.threadHistoryLoading,
      input.threadId,
      input.workspace,
      input.workspaceExplorerLoading,
      input.workspaceFileSaving,
      input.workspaceSwitchReason,
      turnExecution,
    ],
  );

  const partitionedPendingRequests = useMemo(
    () => partitionPendingRequests(input.messages, input.pendingRequests ?? [], pendingRequestAnchorIdsRef.current),
    [input.messages, input.pendingRequests],
  );
  pendingRequestAnchorIdsRef.current = partitionedPendingRequests.nextAnchorIdsByRequestId;

  const todoPresentation = useMemo(
    () => selectThreadTodoState(input.notices ?? [], input.threadId),
    [input.notices, input.threadId],
  );
  const sessionToasts = useMemo(
    () => selectSessionToastItems(todoPresentation.visibleNotices),
    [todoPresentation.visibleNotices],
  );
  const proposedPlanActionTurnId = useMemo(() => {
    const turnId =
      findProposedPlanActionCandidate({
        messages: input.messages,
        collaborationModeKind: input.runtimeSettings?.collaborationModeKind ?? 'default',
        turnExecution,
      })?.turnId ?? null;

    if (!input.threadId || !turnId || isProposedPlanActionDismissed(input.threadId, turnId)) {
      return null;
    }

    return turnId;
  }, [input.messages, input.runtimeSettings?.collaborationModeKind, input.threadId, turnExecution]);

  return {
    fallbackViewModel,
    partitionedPendingRequests,
    activeTodoList: todoPresentation.activeTodo,
    sessionToasts,
    proposedPlanActionTurnId,
    showProposedPlanAction: Boolean(
      proposedPlanActionTurnId && (input.onConfirmProposedPlanAction || input.onDismissProposedPlanAction),
    ),
  };
}
