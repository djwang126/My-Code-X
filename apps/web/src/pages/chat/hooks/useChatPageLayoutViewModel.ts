import { useMemo, useRef } from 'react';

import { selectChatToastItems } from '../../../features/chat/runtime';
import {
  buildProposedPlanActionsByItemId,
  readProposedPlanActionDecision,
} from '../../../features/chat/commands';
import { selectChatTodoState } from '../../../features/chat/todo';
import { partitionPendingRequests } from '../lib/pending-request-anchors';
import { buildChatPageViewModel } from '../state/view-model';
import type { ChatPageProps } from '../types';

export function useChatPageLayoutViewModel(input: ChatPageProps) {
  const pendingRequestAnchorIdsRef = useRef(new Map<string, string>());
  const latestTurn = input.latestTurn;
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
          workspaceThreadsLoad: input.workspaceThreadsLoading ? 'pending' : 'idle',
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
          latestTurn,
          pendingRequests: input.pendingRequests ?? [],
        },
      }),
    [
      input.interruptPending,
      input.isRestarting,
      input.pageFeedback,
      input.pendingRequests,
      input.workspaceThreadsLoading,
      input.threadId,
      input.workspace,
      input.workspaceExplorerLoading,
      input.workspaceFileSaving,
      input.workspaceSwitchReason,
      latestTurn,
    ],
  );

  const partitionedPendingRequests = useMemo(
    () => partitionPendingRequests(input.messages, input.pendingRequests ?? [], pendingRequestAnchorIdsRef.current),
    [input.messages, input.pendingRequests],
  );
  pendingRequestAnchorIdsRef.current = partitionedPendingRequests.nextAnchorIdsByRequestId;

  const todoPresentation = useMemo(
    () => selectChatTodoState(input.notices ?? [], input.threadId),
    [input.notices, input.threadId],
  );
  const chatToasts = useMemo(
    () => selectChatToastItems(todoPresentation.visibleNotices),
    [todoPresentation.visibleNotices],
  );
  const proposedPlanActionsByItemId = useMemo(
    () =>
      buildProposedPlanActionsByItemId({
        messages: input.messages,
        latestTurn,
        threadId: input.threadId,
        canCreateAvailableAction: Boolean(
          input.onConfirmProposedPlanAction || input.onDismissProposedPlanAction,
        ),
        readDecision: readProposedPlanActionDecision,
      }),
    [
      input.messages,
      input.threadId,
      input.onConfirmProposedPlanAction,
      input.onDismissProposedPlanAction,
      input.proposedPlanActionRevision,
      latestTurn,
    ],
  );

  return {
    fallbackViewModel,
    partitionedPendingRequests,
    activeTodoList: todoPresentation.activeTodo,
    chatToasts,
    proposedPlanActionsByItemId,
  };
}
