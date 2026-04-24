import type {
  ChatTurn,
  ChatMessageAcceptedPayload,
  SessionError,
  SessionNotice,
  SessionPayload,
  SessionPendingRequest,
  SessionStreamAssistantDelta,
  SessionStreamError,
  SessionStreamMessageCompleted,
  SessionStreamPendingRequestResolved,
  SessionStreamPendingRequestUpdated,
  SessionStreamSessionMetaUpdated,
  SessionStreamSnapshot,
  SessionStreamSystemNotice,
  SessionStreamTimelineItemDelta,
  SessionStreamTimelineItemUpdated,
  SessionStreamTurnStarted,
  SessionStreamTurnCompleted,
  SessionTimelineItem,
} from '../session-types';
import { loadBootstrapTranscriptCache } from '../lib/transcript-cache-storage';
import { readBootstrapScope } from '../../../session/scope';

export interface ChatRuntimeState {
  workspace: string;
  threadId: string;
  latestTurn: ChatTurn | null;
  operations: RuntimeOperationState;
  threadName: string;
  threadStatus: NonNullable<SessionPayload['session']['threadStatus']> | null;
  threadStatusText: string;
  tokenUsageText: string;
  statusMessage: string;
  errorMessage: string;
  errorDetail: SessionError | null;
  messages: SessionTimelineItem[];
  notices: SessionNotice[];
  pendingRequests: SessionPendingRequest[];
  streamUrl: string;
  streamRevision: number;
  preferences: SessionPayload['preferences'];
  options: SessionPayload['options'];
}

export interface RuntimeOperationState {
  send: 'idle' | 'pending';
  interrupt: 'idle' | 'pending';
}

export type ChatRuntimeAction =
  | { type: 'bootstrap/reset'; workspace: string; threadId: string }
  | { type: 'bootstrap/succeeded'; payload: SessionPayload }
  | { type: 'stream/snapshot'; payload: SessionStreamSnapshot }
  | { type: 'stream/session-meta-updated'; payload: SessionStreamSessionMetaUpdated }
  | { type: 'stream/system-notice'; payload: SessionStreamSystemNotice }
  | { type: 'stream/pending-request-updated'; payload: SessionStreamPendingRequestUpdated }
  | { type: 'stream/pending-request-resolved'; payload: SessionStreamPendingRequestResolved }
  | { type: 'stream/timeline-item-updated'; payload: SessionStreamTimelineItemUpdated }
  | { type: 'stream/timeline-item-delta'; payload: SessionStreamTimelineItemDelta }
  | { type: 'stream/assistant-deltas'; payloads: SessionStreamAssistantDelta[]; latestPayload: SessionStreamAssistantDelta }
  | { type: 'stream/turn-started'; payload: SessionStreamTurnStarted }
  | { type: 'stream/message-completed'; payload: SessionStreamMessageCompleted }
  | { type: 'stream/turn-completed'; payload: SessionStreamTurnCompleted }
  | { type: 'stream/error'; payload: SessionStreamError }
  | { type: 'request/submission-started'; requestId: string }
  | { type: 'request/submission-failed'; requestId: string; errorMessage: string }
  | { type: 'preferences/updated'; preferences: SessionPayload['preferences'] }
  | { type: 'send/requested' }
  | { type: 'interrupt/succeeded'; payload: import('../session-types').ChatInterruptAcceptedPayload }
  | { type: 'interrupt/requested' }
  | { type: 'interrupt/failed'; errorMessage: string }
  | { type: 'send/succeeded'; payload: ChatMessageAcceptedPayload; acceptedText: string }
  | { type: 'send/failed'; errorMessage: string };

export function createBaseChatRuntimeState(): ChatRuntimeState {
  return {
    workspace: '',
    threadId: '',
    latestTurn: null,
    operations: {
      send: 'idle',
      interrupt: 'idle',
    },
    threadName: '',
    threadStatus: null,
    threadStatusText: '',
    tokenUsageText: '',
    statusMessage: 'Session synced',
    errorMessage: '',
    errorDetail: null,
    messages: [],
    notices: [],
    pendingRequests: [],
    streamUrl: '',
    streamRevision: 0,
    preferences: {},
    options: {},
  };
}

export function createInitialChatRuntimeState(): ChatRuntimeState {
  const scope = readBootstrapScope();
  const cache = loadBootstrapTranscriptCache();

  if (!cache) {
    return {
      ...createBaseChatRuntimeState(),
      workspace: scope.workspace,
      threadId: scope.threadId,
    };
  }

  return {
    ...createBaseChatRuntimeState(),
    workspace: cache.workspace,
    threadId: cache.threadId,
    latestTurn: cache.latestTurn,
    threadName: cache.threadName,
    messages: cache.messages,
  };
}

export function resolveStreamThreadId(currentThreadId: string, nextThreadId: string | null | undefined): string {
  return typeof nextThreadId === 'string' && nextThreadId ? nextThreadId : currentThreadId;
}

export function withResolvedStreamThreadId(
  state: ChatRuntimeState,
  nextThreadId: string | null | undefined,
  nextState: Omit<Partial<ChatRuntimeState>, 'threadId'>,
): ChatRuntimeState {
  return {
    ...state,
    ...nextState,
    threadId: resolveStreamThreadId(state.threadId, nextThreadId),
  };
}
