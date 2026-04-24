import { readOptionalCollaborationModeKind } from '../../../../shared/lib/collaboration-mode';
import type { ChatRuntimeAction, ChatRuntimeState, RuntimeOperationState } from './chat-runtime-state';
import { createBaseChatRuntimeState, withResolvedStreamThreadId } from './chat-runtime-state';
import {
  normalizeNotices,
  normalizePendingRequests,
  normalizeTimelineItems,
  reconcileTimelineItem,
  updatePendingRequestSubmissionState,
  upsertMessage,
  upsertNotice,
  upsertPendingRequest,
} from './session-collections';
import { createCanonicalUserMessageId } from '@my-code-x/contracts';
import { applyTimelineItemDelta } from './session-timeline-deltas';
import {
  applyAssistantDeltas,
  createHydratedChatRuntimeState,
  readCurrentCollaborationModeKind,
  withPreferencesSessionRuntimeMetadata,
} from './session-stream-updaters';
import { applyConversationScopedTurnError, getSharedErrorMessage } from './session-error-routing';
import { applyChatTurn, isChatTurnStateTerminal } from './chat-turn-state';

function withOperation(
  operations: RuntimeOperationState,
  nextOperation: Partial<RuntimeOperationState>,
): RuntimeOperationState {
  return {
    ...operations,
    ...nextOperation,
  };
}

export function chatRuntimeReducer(state: ChatRuntimeState, action: ChatRuntimeAction): ChatRuntimeState {
  switch (action.type) {
    case 'bootstrap/reset':
      if (
        isChatTurnStateTerminal(state.latestTurn) &&
        state.threadId === action.threadId &&
        state.workspace === action.workspace &&
        state.messages.length > 0
      ) {
        return {
          ...state,
          operations: {
            send: 'idle',
            interrupt: 'idle',
          },
          statusMessage: 'Loading session…',
          errorMessage: '',
          errorDetail: null,
        };
      }

      return {
        ...createBaseChatRuntimeState(),
        workspace: action.workspace,
        threadId: action.threadId,
        statusMessage: 'Loading session…',
      };
    case 'bootstrap/succeeded':
      return createHydratedChatRuntimeState(action.payload, state);
    case 'stream/snapshot': {
      const snapshotCollaborationModeKind =
        action.payload.collaborationModeKind !== undefined
          ? readOptionalCollaborationModeKind(action.payload.collaborationModeKind) ?? null
          : readCurrentCollaborationModeKind(state.preferences);
      const normalizedMessages = applyConversationScopedTurnError(
        normalizeTimelineItems(action.payload.messages),
        action.payload.lastError,
      );

      return withResolvedStreamThreadId(state, action.payload.threadId, {
        latestTurn: applyChatTurn(action.payload.latestTurn, 'session stream snapshot.latestTurn'),
        operations:
          action.payload.latestTurn?.status === 'inProgress'
            ? state.operations
            : {
                send: 'idle',
                interrupt: 'idle',
              },
        messages: normalizedMessages,
        threadName: action.payload.threadName ?? state.threadName,
        threadStatus: action.payload.threadStatus ?? null,
        threadStatusText: action.payload.threadStatusText ?? state.threadStatusText,
        tokenUsageText: action.payload.tokenUsageText ?? state.tokenUsageText,
        notices: normalizeNotices(action.payload.notices),
        pendingRequests: normalizePendingRequests(action.payload.pendingRequests),
        statusMessage: action.payload.threadStatusText || state.statusMessage,
        errorMessage: getSharedErrorMessage(action.payload.lastError),
        errorDetail: action.payload.lastError ?? null,
        preferences: withPreferencesSessionRuntimeMetadata(state.preferences, {
          collaborationModeKind: snapshotCollaborationModeKind,
          promptOverride: action.payload.promptOverride,
        }),
      });
    }
    case 'stream/session-meta-updated':
      return withResolvedStreamThreadId(state, action.payload.threadId, {
        threadName: action.payload.threadName ?? state.threadName,
        threadStatus: action.payload.threadStatus ?? null,
        threadStatusText: action.payload.threadStatusText ?? state.threadStatusText,
        tokenUsageText: action.payload.tokenUsageText ?? state.tokenUsageText,
        statusMessage: action.payload.threadStatusText ?? state.statusMessage,
      });
    case 'stream/system-notice':
      return withResolvedStreamThreadId(state, action.payload.threadId, {
        notices: upsertNotice(state.notices, action.payload.notice),
      });
    case 'stream/pending-request-updated':
      return withResolvedStreamThreadId(state, action.payload.threadId, {
        pendingRequests: upsertPendingRequest(state.pendingRequests, action.payload.request),
        errorMessage: '',
        errorDetail: null,
      });
    case 'stream/pending-request-resolved':
      return withResolvedStreamThreadId(state, action.payload.threadId, {
        pendingRequests: state.pendingRequests.filter(request => request.id !== action.payload.requestId),
        notices: upsertNotice(state.notices, action.payload.notice),
        errorMessage: '',
        errorDetail: null,
      });
    case 'stream/timeline-item-updated': {
      return withResolvedStreamThreadId(state, action.payload.threadId, {
        messages: upsertMessage(state.messages, reconcileTimelineItem(state.messages, action.payload.item)),
        errorMessage: '',
        errorDetail: null,
      });
    }
    case 'stream/timeline-item-delta': {
      return withResolvedStreamThreadId(state, action.payload.threadId, {
        messages: applyTimelineItemDelta(state.messages, action.payload),
        errorMessage: '',
        errorDetail: null,
      });
    }
    case 'stream/assistant-deltas': {
      if (!action.payloads.length) {
        return state;
      }

      return withResolvedStreamThreadId(state, action.latestPayload.threadId, {
        messages: applyAssistantDeltas(state.messages, action.payloads),
        errorMessage: '',
        errorDetail: null,
      });
    }
    case 'stream/turn-started':
      return withResolvedStreamThreadId(state, action.payload.threadId, {
        latestTurn: applyChatTurn(action.payload.turn, 'session stream turn started.turn'),
        operations: {
          send: 'idle',
          interrupt: 'idle',
        },
        errorMessage: '',
        errorDetail: null,
      });
    case 'stream/message-completed':
      return withResolvedStreamThreadId(state, action.payload.threadId, {
        messages: upsertMessage(state.messages, action.payload.message),
        errorMessage: '',
        errorDetail: null,
      });
    case 'stream/turn-completed':
      return withResolvedStreamThreadId(state, action.payload.threadId, {
        latestTurn: applyChatTurn(action.payload.turn, 'session stream turn completed.turn'),
        operations: {
          send: 'idle',
          interrupt: 'idle',
        },
        errorMessage: getSharedErrorMessage(action.payload.error),
        errorDetail: action.payload.error,
        messages: applyConversationScopedTurnError(state.messages, action.payload.error),
      });
    case 'stream/error':
      return {
        ...state,
        errorMessage: getSharedErrorMessage(action.payload.error),
        errorDetail: action.payload.error,
        messages: applyConversationScopedTurnError(state.messages, action.payload.error),
      };
    case 'request/submission-started':
      return {
        ...state,
        pendingRequests: updatePendingRequestSubmissionState(state.pendingRequests, action.requestId, 'submitting'),
        errorMessage: '',
        errorDetail: null,
      };
    case 'request/submission-failed':
      return {
        ...state,
        pendingRequests: updatePendingRequestSubmissionState(state.pendingRequests, action.requestId, 'idle'),
        errorMessage: action.errorMessage,
        errorDetail: null,
      };
    case 'preferences/updated':
      return {
        ...state,
        preferences: action.preferences,
      };
    case 'send/requested':
      return {
        ...state,
        operations: withOperation(state.operations, { send: 'pending' }),
        errorMessage: '',
        errorDetail: null,
      };
    case 'interrupt/requested':
      return {
        ...state,
        operations: withOperation(state.operations, { interrupt: 'pending' }),
        errorMessage: '',
        errorDetail: null,
      };
    case 'interrupt/succeeded': {
      return {
        ...state,
        operations:
          state.latestTurn?.status === 'inProgress'
            ? withOperation(state.operations, { interrupt: 'pending' })
            : withOperation(state.operations, { interrupt: 'idle' }),
        errorMessage: '',
        errorDetail: null,
      };
    }
    case 'interrupt/failed': {
      return {
        ...state,
        operations: withOperation(state.operations, { interrupt: 'idle' }),
        errorMessage: action.errorMessage,
        errorDetail: null,
      };
    }
    case 'send/succeeded': {
      return {
        ...state,
        threadId: action.payload.threadId,
        latestTurn: applyChatTurn(action.payload.turn, 'chat message accepted payload.turn'),
        operations: {
          send: 'idle',
          interrupt: 'idle',
        },
        messages: upsertMessage(state.messages, {
          id: createCanonicalUserMessageId({ turnId: action.payload.turn.id }),
          kind: 'message',
          itemType: 'userMessage',
          role: 'user',
          text: action.acceptedText,
          state: 'complete',
          threadId: action.payload.threadId,
          turnId: action.payload.turn.id,
        }),
        streamUrl: action.payload.stream.url,
        streamRevision: state.streamRevision + 1,
        errorMessage: '',
        errorDetail: null,
      };
    }
    case 'send/failed':
      return {
        ...state,
        operations: withOperation(state.operations, { send: 'idle' }),
        errorMessage: action.errorMessage,
        errorDetail: null,
      };
    default:
      return state;
  }
}
