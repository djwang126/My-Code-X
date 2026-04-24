import { deriveChatPageGuards } from './action-guards';
import { deriveChatInteractionState } from './interaction-state';
import type {
  ChatPageError,
  ChatPageOperationState,
  ChatPageSessionSnapshot,
} from './page-state-types';

export type ChatPageViewModelInput = {
  currentError: ChatPageError | null;
  draft: string;
  operations: ChatPageOperationState;
  session: ChatPageSessionSnapshot;
};

export type ChatPageViewModel = ReturnType<typeof buildChatPageViewModel>;

function hasWorkspace(session: ChatPageSessionSnapshot) {
  return Boolean(session.workspace.trim());
}

export function buildChatPageViewModel(input: ChatPageViewModelInput) {
  const interactionState = deriveChatInteractionState({
    session: input.session,
    operations: input.operations,
  });
  const guards = deriveChatPageGuards({
    interactionState,
    session: input.session,
    operations: input.operations,
    draft: input.draft,
  });
  const isRunning = interactionState === 'running';
  const isInterrupting = interactionState === 'interrupting';
  const isReadyIdle = interactionState === 'ready-idle';
  const isRestarting = interactionState === 'restarting';
  const isBootstrapping = interactionState === 'bootstrapping';
  const workspacePresent = hasWorkspace(input.session);
  const threadPresent = Boolean(input.session.threadId.trim());
  const composerEditable = isReadyIdle && workspacePresent;
  const sendButtonDisabled = isInterrupting || (!isRunning && (!composerEditable || !guards.canSend));
  const actionBlocked = !isReadyIdle;

  return {
    interactionState,
    currentError: input.currentError,
    guards,
    hasWorkspace: workspacePresent,
    hasThread: threadPresent,
    hasPendingRequests: input.session.pendingRequests.length > 0,
    pendingRequestCount: input.session.pendingRequests.length,
    isRunning,
    isInterrupting,
    isRestarting,
    isBootstrapping,
    actionBlocked,
    inputDisabled: !composerEditable,
    sendButtonDisabled,
  };
}
