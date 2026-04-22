import type {
  ChatInteractionState,
  ChatPageSessionSnapshot,
  ChatPageOperationState,
} from './chat-page-state-types';
import {
  canInterruptForTurnExecution,
  canSendForTurnExecution,
} from '../../chat-runtime';

export type ChatPageGuardInput = {
  interactionState: ChatInteractionState;
  session: ChatPageSessionSnapshot;
  operations: ChatPageOperationState;
  draft: string;
};

export type ChatPageGuards = {
  canSend: boolean;
  canInterrupt: boolean;
  canRestart: boolean;
  canSwitchWorkspace: boolean;
  workspaceSwitchReason: string | null;
  canOpenExplorer: boolean;
  canSaveWorkspace: boolean;
  canNewThread: boolean;
  canOpenThreadHistory: boolean;
  canRollback: boolean;
  canCompact: boolean;
  canSubmitPendingRequests: boolean;
};

const RUNNING_WORKSPACE_SWITCH_REASON = 'Finish the active turn before switching workspaces.';
const AWAITING_REQUESTS_WORKSPACE_SWITCH_REASON = 'Complete the pending requests before switching workspaces.';
const RESTARTING_WORKSPACE_SWITCH_REASON = 'Wait for restart to finish before switching workspaces.';
const BOOTSTRAPPING_WORKSPACE_SWITCH_REASON = 'Wait for the session to finish loading before switching workspaces.';
const AUTH_REQUIRED_WORKSPACE_SWITCH_REASON = 'Refresh authentication before switching workspaces.';
const LOAD_ERROR_WORKSPACE_SWITCH_REASON = 'Recover the session before switching workspaces.';
const WORKSPACE_SWITCH_PENDING_REASON = 'Wait for the current workspace switch to finish.';

function hasWorkspace(session: ChatPageSessionSnapshot) {
  return Boolean(session.workspace?.trim());
}

function hasThread(session: ChatPageSessionSnapshot) {
  return Boolean(session.threadId?.trim());
}

function hasPendingRequests(session: ChatPageSessionSnapshot) {
  return (session.pendingRequests?.length ?? 0) > 0;
}

function hasRequestSubmissionInFlight(input: ChatPageGuardInput) {
  return (
    input.operations.pendingRequestSubmit === 'pending' ||
    (input.session.pendingRequests ?? []).some(request => request.submitState === 'submitting')
  );
}

function getWorkspaceSwitchReason(interactionState: ChatInteractionState) {
  if (interactionState === 'bootstrapping') {
    return BOOTSTRAPPING_WORKSPACE_SWITCH_REASON;
  }

  if (interactionState === 'auth-required') {
    return AUTH_REQUIRED_WORKSPACE_SWITCH_REASON;
  }

  if (interactionState === 'load-error') {
    return LOAD_ERROR_WORKSPACE_SWITCH_REASON;
  }

  if (interactionState === 'running') {
    return RUNNING_WORKSPACE_SWITCH_REASON;
  }

  if (interactionState === 'interrupting') {
    return RUNNING_WORKSPACE_SWITCH_REASON;
  }

  if (interactionState === 'awaiting-requests') {
    return AWAITING_REQUESTS_WORKSPACE_SWITCH_REASON;
  }

  if (interactionState === 'restarting') {
    return RESTARTING_WORKSPACE_SWITCH_REASON;
  }

  return null;
}

export function deriveChatPageGuards(input: ChatPageGuardInput): ChatPageGuards {
  const workspacePresent = hasWorkspace(input.session);
  const threadPresent = hasThread(input.session);
  const draftPresent = Boolean(input.draft.trim());
  const pendingRequestsPresent = hasPendingRequests(input.session);
  const workspaceSwitchReason =
    input.operations.workspaceSwitch === 'pending'
      ? WORKSPACE_SWITCH_PENDING_REASON
      : getWorkspaceSwitchReason(input.interactionState);
  const canMutateThread = input.interactionState === 'ready-idle' && threadPresent;
  const sessionReady = (input.session.phase ?? 'ready') === 'ready';
  const interruptPending = input.operations.interrupt ?? 'idle';
  const restartPending = input.operations.restart ?? 'idle';

  return {
    canSend:
      input.interactionState === 'ready-idle' &&
      input.operations.send === 'idle' &&
      canSendForTurnExecution(input.session.turnExecution) &&
      workspacePresent &&
      draftPresent &&
      !pendingRequestsPresent,
    canInterrupt:
      input.interactionState === 'running' &&
      threadPresent &&
      canInterruptForTurnExecution(input.session.turnExecution) &&
      interruptPending === 'idle',
    canRestart:
      sessionReady &&
      workspacePresent &&
      restartPending === 'idle',
    canSwitchWorkspace: workspaceSwitchReason === null,
    workspaceSwitchReason,
    canOpenExplorer: workspacePresent,
    canSaveWorkspace: true,
    canNewThread: input.interactionState === 'ready-idle' && workspacePresent && workspaceSwitchReason === null,
    canOpenThreadHistory: canMutateThread && input.operations.threadHistoryLoad === 'idle' && workspaceSwitchReason === null,
    canRollback: canMutateThread && input.operations.rollback === 'idle',
    canCompact: canMutateThread && input.operations.compact === 'idle',
    canSubmitPendingRequests:
      input.interactionState === 'awaiting-requests' &&
      pendingRequestsPresent &&
      !hasRequestSubmissionInFlight(input),
  };
}
