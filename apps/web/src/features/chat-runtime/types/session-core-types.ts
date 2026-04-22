import type {
  SessionError,
  SessionActiveTurnExecutionState,
  SessionStreamingTurnLifecycle,
  SessionTerminalTurnLifecycle,
  SessionTurnExecutionState,
  SessionThreadStatus,
} from '@my-code-x/contracts';

export type {
  SessionCodexErrorInfo,
  SessionError,
  SessionActiveTurnExecutionState,
  SessionTerminalTurnLifecycle,
  SessionStreamingTurnLifecycle,
  SessionTurnExecutionState,
  SessionTurnLifecycle,
  SessionThreadStatus,
} from '@my-code-x/contracts';

export type SessionStreamingTurnExecutionState = SessionActiveTurnExecutionState & {
  turnLifecycle: SessionStreamingTurnLifecycle;
};

export type SessionTerminalTurnExecutionState = SessionActiveTurnExecutionState & {
  turnLifecycle: SessionTerminalTurnLifecycle;
};

export type SessionNotice = {
  id: string;
  level: 'info' | 'warning' | 'error';
  title: string;
  text: string;
  // Upstream Codex may still emit `update_plan` notice payloads here.
  // Inside My-Code-X, that payload is treated as the thread-todo domain,
  // not the separate proposed-plan / plan-mode domain.
  raw?: Record<string, unknown>;
};

export type SessionPayload = {
  server: { ok: boolean; serverInstanceId: string; authRequired: boolean };
  viewer: { viewerId: string; slotId: string };
  session: {
    workspace: string;
    threadId: string;
    turnExecution: SessionTurnExecutionState;
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
  turnExecution: SessionStreamingTurnExecutionState;
  stream: { url: string };
};

export type ChatInterruptAcceptedPayload = {
  ok: boolean;
  threadId: string;
  turnExecution: SessionStreamingTurnExecutionState;
};

export type ThreadCompactAcceptedPayload = {
  ok: boolean;
  threadId: string;
};

export type ThreadRollbackAcceptedPayload = {
  ok: boolean;
  threadId: string;
};

export type ThreadForkAcceptedPayload = {
  ok: boolean;
  threadId: string;
};

export type ReviewStartTarget =
  | { type: 'uncommittedChanges' }
  | { type: 'baseBranch'; branch: string }
  | { type: 'commit'; sha: string; title?: string }
  | { type: 'custom'; instructions: string };

export type ReviewStartAcceptedPayload = {
  ok: boolean;
  reviewThreadId?: string;
};

export type AppRestartAcceptedPayload = {
  ok: boolean;
  restarting: boolean;
};
