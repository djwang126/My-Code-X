import type { SessionError, SessionThreadStatus, SessionTurnExecutionState } from '@my-code-x/contracts';

import type {
  SessionNotice,
  SessionStreamingTurnExecutionState,
  SessionTerminalTurnExecutionState,
} from './session-core-types';
import type { SessionPendingRequest } from './session-request-types';
import type { AssistantTimelineMessageItem, SessionTimelineItem } from './session-timeline-types';

export type SessionStreamSnapshot = {
  threadId: string;
  turnExecution: SessionTurnExecutionState;
  collaborationModeKind?: string | null;
  promptOverride?: string | null;
  messages: SessionTimelineItem[];
  threadName?: string;
  threadStatus?: SessionThreadStatus | null;
  threadStatusText?: string;
  tokenUsageText?: string;
  notices?: SessionNotice[];
  pendingRequests?: SessionPendingRequest[];
  lastError?: SessionError | null;
};

export type SessionStreamAssistantDelta = {
  threadId: string;
  turnId: string;
  messageId: string;
  delta: string;
  text: string;
};

export type SessionStreamTurnStarted = {
  threadId: string;
  turnExecution: SessionStreamingTurnExecutionState;
};

export type SessionStreamMessageCompleted = {
  threadId: string;
  turnId: string;
  message: AssistantTimelineMessageItem;
};

export type SessionStreamTimelineItemUpdated = {
  threadId: string;
  turnId: string | null;
  item: SessionTimelineItem;
};

export type SessionStreamTimelineItemDelta = {
  threadId: string;
  turnId: string | null;
  itemId: string;
  itemType: string;
  delta?: string;
  deltaField?:
    | 'summary'
    | 'summary_boundary'
    | 'content'
    | 'aggregatedOutput'
    | 'output'
    | 'progress'
    | 'terminalInteraction';
  index?: number;
  value?: unknown;
};

export type SessionStreamSessionMetaUpdated = {
  threadId: string;
  threadName?: string;
  threadStatus?: SessionThreadStatus | null;
  threadStatusText?: string;
  tokenUsageText?: string;
};

export type SessionStreamSystemNotice = {
  threadId: string;
  notice: SessionNotice;
};

export type SessionStreamPendingRequestUpdated = {
  threadId: string;
  request: SessionPendingRequest;
};

export type SessionStreamPendingRequestResolved = {
  threadId: string;
  requestId: string;
  notice: SessionNotice;
};

export type SessionStreamTurnCompleted = {
  threadId: string;
  turnExecution: SessionTerminalTurnExecutionState;
  error: SessionError | null;
};

export type SessionStreamError = {
  threadId: string;
  turnId: string | null;
  error: SessionError | null;
};
