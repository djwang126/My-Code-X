import type {
  ChatTurn,
  SessionError,
  SessionThreadStatus,
} from '@my-code-x/contracts';

export type {
  AppRestartAcceptedPayload,
  ChatTurn,
  ChatTurnStatus,
  ReviewStartAcceptedPayload,
  ReviewStartTarget,
  SessionCodexErrorInfo,
  SessionError,
  SessionThreadStatus,
  ThreadCompactAcceptedPayload,
  ThreadForkAcceptedPayload,
  ThreadRollbackAcceptedPayload,
} from '@my-code-x/contracts';

export type ChatTurnInProgress = ChatTurn & { status: 'inProgress' };

export type ChatTurnTerminal = ChatTurn & { status: 'completed' | 'interrupted' | 'failed' };

export type SessionNotice = {
  id: string;
  level: 'info' | 'warning' | 'error';
  title: string;
  text: string;
  // Upstream Codex may still emit `update_plan` notice payloads here.
  // Inside My-Code-X, that payload is treated as the chat-todo domain,
  // not the separate proposed-plan / plan-mode domain.
  raw?: Record<string, unknown>;
};

export type SessionPayload = {
  server: { ok: boolean; serverInstanceId: string; authRequired: boolean };
  viewer: { viewerId: string; slotId: string };
  session: {
    workspace: string;
    threadId: string;
    latestTurn: ChatTurn | null;
    collaborationModeKind?: string | null;
    promptOverride?: string | null;
    lastUpdatedAt: string;
    threadName?: string;
    threadStatus?: SessionThreadStatus | null;
    threadStatusText?: string;
    tokenUsageText?: string;
    lastError?: SessionError | null;
  };
  conversation: { messages: import('./session-timeline-types').SessionTimelineItem[] };
  stream: { url: string };
  preferences: Record<string, unknown>;
  options: Record<string, unknown>;
  notices?: SessionNotice[];
  pendingRequests?: import('./session-request-types').SessionPendingRequest[];
};

export type ChatMessageAcceptedPayload = {
  threadId: string;
  turn: ChatTurnInProgress;
  stream: { url: string };
};

export type ChatInterruptAcceptedPayload = {
  ok: boolean;
  threadId: string;
  turn: ChatTurn | null;
};

