import type { ChatTurn } from './chat-turn.js';
import type { SessionError, SessionThreadStatus } from './session-error.js';

export type SessionNoticePayload = {
  id: string;
  level?: string;
  title?: string;
  text?: string;
  raw?: unknown;
};

export type SessionTimelineItemPayload = {
  id: string;
  kind: string;
  itemType: string;
  text: string;
  state: string;
  threadId: string | null;
  turnId: string | null;
  role?: string;
  content?: unknown[];
  status?: string;
  raw?: unknown;
};

export type SessionPendingRequestPayload = {
  id: string;
  method?: string;
  kind?: string;
  threadId?: string;
  turnId?: string | null;
  title?: string;
  prompt?: string;
  submitState?: string;
  raw?: unknown;
};

export type SessionSnapshotPayload = {
  threadId: string;
  latestTurn: ChatTurn | null;
  collaborationModeKind?: string | null;
  promptOverride?: string | null;
  threadName?: string;
  threadStatus?: SessionThreadStatus | null;
  threadStatusText?: string;
  tokenUsageText?: string;
  messages: SessionTimelineItemPayload[];
  notices?: SessionNoticePayload[];
  pendingRequests?: SessionPendingRequestPayload[];
  lastError?: SessionError | null;
  lastUpdatedAt?: string;
};

export type ThreadActionNoticePayload = SessionNoticePayload;
export type ThreadActionTimelineItemPayload = SessionTimelineItemPayload;
export type ThreadActionPendingRequestPayload = SessionPendingRequestPayload;
export type ThreadActionSnapshotPayload = SessionSnapshotPayload;

export type ThreadStartAcceptedPayload = {
  kind: 'threadStarted';
  threadId: string;
  snapshot: SessionSnapshotPayload;
};

export type ThreadResumeAcceptedPayload = {
  kind: 'threadResumed';
  threadId: string;
  snapshot: SessionSnapshotPayload;
};

export type ThreadCompactAcceptedPayload = {
  kind: 'threadCompactStarted';
  threadId: string;
};

export type ThreadRollbackAcceptedPayload = {
  kind: 'threadRolledBack';
  threadId: string;
  snapshot: SessionSnapshotPayload;
};

export type ThreadForkAcceptedPayload = {
  kind: 'threadForked';
  sourceThreadId: string;
  threadId: string;
  snapshot: SessionSnapshotPayload;
};

export type ThreadActionAcceptedPayload =
  | ThreadStartAcceptedPayload
  | ThreadResumeAcceptedPayload
  | ThreadCompactAcceptedPayload
  | ThreadRollbackAcceptedPayload
  | ThreadForkAcceptedPayload;
