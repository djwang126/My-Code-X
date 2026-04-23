export type SessionCodexErrorInfo =
  | 'contextWindowExceeded'
  | 'usageLimitExceeded'
  | 'serverOverloaded'
  | 'internalServerError'
  | 'unauthorized'
  | 'badRequest'
  | 'threadRollbackFailed'
  | 'sandboxError'
  | 'other'
  | { httpConnectionFailed: { httpStatusCode: number | null } }
  | { responseStreamConnectionFailed: { httpStatusCode: number | null } }
  | { responseStreamDisconnected: { httpStatusCode: number | null } }
  | { responseTooManyFailedAttempts: { httpStatusCode: number | null } }
  | { activeTurnNotSteerable: { turnKind: string } };

export type SessionErrorPresentationScope = 'conversation' | 'shared';

export type SessionError = {
  message: string;
  codexErrorInfo: SessionCodexErrorInfo | null;
  additionalDetails: string | null;
  httpStatusCode: number | null;
  willRetry: boolean | null;
  threadId: string | null;
  turnId: string | null;
  presentationScope: SessionErrorPresentationScope;
  source: string;
  raw: Record<string, unknown> | null;
};

export type SessionThreadStatus =
  | string
  | {
      type: string;
      activeFlags?: string[];
      [key: string]: unknown;
    };

export function cloneStructuredValue<T>(value: T): T {
  if (!value || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(entry => cloneStructuredValue(entry)) as T;
  }

  const objectValue = value as Record<string, unknown>;
  const clonedEntries = Object.entries(objectValue).map(([key, entry]) => [key, cloneStructuredValue(entry)]);
  return Object.fromEntries(clonedEntries) as T;
}

export function cloneSessionThreadStatus(threadStatus: SessionThreadStatus | null | undefined): SessionThreadStatus | null {
  if (!threadStatus) {
    return null;
  }

  if (typeof threadStatus !== 'object') {
    return threadStatus;
  }

  return cloneStructuredValue(threadStatus);
}

export function cloneSessionError(error: SessionError | null | undefined): SessionError | null {
  if (!error) {
    return null;
  }

  return {
    ...error,
    raw: cloneStructuredValue(error.raw),
  };
}

export {
  createIdleSessionTurnExecution,
  createInterruptingSessionTurnExecution,
  createRunningSessionTurnExecution,
  createStartedSessionTurnExecution,
  createStreamingSessionTurnExecution,
  createTerminalSessionTurnExecution,
  canSessionExecutionInterrupt,
  canSessionExecutionSend,
  canSessionTurnInterrupt,
  canSessionTurnSend,
  deriveSessionStreamingLifecycle,
  isSessionExecutionActive,
  isSessionExecutionTerminal,
  isSessionExecutionWaitingForInput,
  isSessionTurnActive,
  isSessionTurnTerminal,
  isSessionWaitingForInput,
  parseSessionActiveTurnId,
  parseSessionStreamingTurnLifecycle,
  parseSessionTerminalTurnLifecycle,
  parseSessionTurnExecution,
  parseSessionTurnLifecycle,
  readSessionActiveTurnId,
  readSessionTurnExecution,
  readSessionTurnLifecycle,
  serializeSessionTurnExecution,
  type CreateRunningSessionTurnExecutionInput,
  type CreateStartedSessionTurnExecutionInput,
  type CreateStreamingSessionTurnExecutionInput,
  type SessionActiveTurnExecutionState,
  type SessionIdleTurnExecutionState,
  type SessionStreamingTurnLifecycle,
  type SessionTerminalTurnLifecycle,
  type SessionTurnExecutionInput,
  type SessionTurnExecutionState,
  type SessionTurnLifecycle,
} from './session-turn-execution.js';

export {
  createCanonicalUserMessageId,
  isCanonicalUserMessageIdForTurn,
  reconcileCanonicalUserMessageTimelineItem,
  type CanonicalTimelineItemLike,
  type CanonicalTimelineItemRawValue,
  type CreateCanonicalUserMessageIdInput,
  type ReconcileCanonicalUserMessageTimelineItemInput,
} from './session-user-message-id.js';

export type {
  ThreadCompactAcceptedPayload,
  ThreadForkAcceptedPayload,
  ThreadRollbackAcceptedPayload,
} from './chat-command-types.js';

export type { ReviewStartAcceptedPayload, ReviewStartTarget } from './tools-review-types.js';

export type { AppRestartAcceptedPayload } from './tools-restart-types.js';

export type { WorkspaceThreadEntry, WorkspaceThreadsPayload } from './workspace-thread-types.js';

export type {
  WorkspaceEditableFileDetail,
  WorkspaceFile,
  WorkspaceFileDetail,
  WorkspaceFileEntry,
  WorkspaceFileSaveAcceptedPayload,
  WorkspaceFilesPayload,
  WorkspaceReadOnlyFileDetail,
  WorkspaceTooLargeFileDetail,
} from './workspace-file-types.js';
