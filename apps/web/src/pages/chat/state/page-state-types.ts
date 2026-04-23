import type { SessionPendingRequest, SessionTurnExecutionState } from '../../../features/chat/runtime';

export type SessionPhase = 'idle' | 'loading' | 'ready' | 'auth-required' | 'error';

export type PrimaryOverlay =
  | 'workspace-navigation'
  | 'tools-panel'
  | 'chat-settings'
  | 'workspace-explorer'
  | 'attachment-dialog'
  | null;

export type OperationStatus = 'idle' | 'pending';

export type ChatInteractionState =
  | 'bootstrapping'
  | 'ready-idle'
  | 'running'
  | 'interrupting'
  | 'awaiting-requests'
  | 'restarting'
  | 'auth-required'
  | 'load-error';

export type ChatPageUiState = {
  primaryOverlay: PrimaryOverlay;
};

export type ChatPageOperationState = {
  bootstrap: OperationStatus;
  send: OperationStatus;
  interrupt: OperationStatus;
  restart: OperationStatus;
  workspaceThreadsLoad: OperationStatus;
  workspaceSwitch: OperationStatus;
  pendingRequestSubmit: OperationStatus;
  workspaceFileOpen: OperationStatus;
  workspaceFileSave: OperationStatus;
  rollback: OperationStatus;
  compact: OperationStatus;
  reviewStart: OperationStatus;
};
export type ChatPageOperationKey = keyof ChatPageOperationState;

export type ChatPageErrorKind =
  | 'bootstrap'
  | 'send'
  | 'interrupt'
  | 'restart'
  | 'rollback'
  | 'compact'
  | 'review-start'
  | 'message-fork'
  | 'workspace-switch'
  | 'workspace-save'
  | 'workspace-threads'
  | 'pending-request'
  | 'workspace-file-open'
  | 'workspace-file-save'
  | 'unknown';

export type ChatPageError = {
  kind: ChatPageErrorKind;
  message: string;
};

export type ChatPageFeedback = {
  scope: 'page';
  error: ChatPageError;
};

export type ChatPageSessionSnapshot = {
  phase: SessionPhase;
  workspace: string;
  threadId: string;
  turnExecution: SessionTurnExecutionState;
  pendingRequests: SessionPendingRequest[];
};

export type ChatPageStateSnapshot = {
  session: ChatPageSessionSnapshot;
  ui: ChatPageUiState;
  operations: ChatPageOperationState;
  currentError: ChatPageError | null;
};
