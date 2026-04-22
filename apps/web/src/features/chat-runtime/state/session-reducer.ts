import { readOptionalCollaborationModeKind } from '../../../shared/lib/collaboration-mode';
import type { SessionAction, SessionState } from './session-state';
import { createBaseSessionState, withResolvedStreamThreadId } from './session-state';
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
  createHydratedSessionState,
  readCurrentCollaborationModeKind,
  withPreferencesSessionRuntimeMetadata,
} from './session-stream-updaters';
import { applyConversationScopedTurnError, getSharedErrorMessage } from './session-error-routing';
import {
  createStreamingExecution,
  createTurnStartedExecution,
  isTurnExecutionTerminal,
} from './session-turn-lifecycle';

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'bootstrap/reset':
      if (
        isTurnExecutionTerminal(state.turnExecution) &&
        state.threadId === action.threadId &&
        state.workspace === action.workspace &&
        state.messages.length > 0
      ) {
        return {
          ...state,
          statusMessage: 'Loading session…',
          errorMessage: '',
          errorDetail: null,
        };
      }

      return {
        ...createBaseSessionState(),
        workspace: action.workspace,
        threadId: action.threadId,
        statusMessage: 'Loading session…',
      };
    case 'bootstrap/succeeded':
      return createHydratedSessionState(action.payload, state);
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
        turnExecution: action.payload.turnExecution,
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
      const nextTurnExecution =
        action.payload.item.state === 'streaming'
          ? createStreamingExecution({
              turnExecution: state.turnExecution,
              turnId: action.payload.turnId,
            })
          : null;
      return withResolvedStreamThreadId(state, action.payload.threadId, {
        ...(nextTurnExecution ? { turnExecution: nextTurnExecution } : {}),
        messages: upsertMessage(state.messages, reconcileTimelineItem(state.messages, action.payload.item)),
        errorMessage: '',
        errorDetail: null,
      });
    }
    case 'stream/timeline-item-delta': {
      const nextTurnExecution = createStreamingExecution({
        turnExecution: state.turnExecution,
        turnId: action.payload.turnId,
      });
      return withResolvedStreamThreadId(state, action.payload.threadId, {
        turnExecution: nextTurnExecution,
        messages: applyTimelineItemDelta(state.messages, action.payload),
        errorMessage: '',
        errorDetail: null,
      });
    }
    case 'stream/assistant-deltas': {
      if (!action.payloads.length) {
        return state;
      }

      const nextTurnExecution = createStreamingExecution({
        turnExecution: state.turnExecution,
        turnId: action.latestPayload.turnId,
      });
      return withResolvedStreamThreadId(state, action.latestPayload.threadId, {
        turnExecution: nextTurnExecution,
        messages: applyAssistantDeltas(state.messages, action.payloads),
        errorMessage: '',
        errorDetail: null,
      });
    }
    case 'stream/turn-started':
      return withResolvedStreamThreadId(state, action.payload.threadId, {
        turnExecution: action.payload.turnExecution,
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
        turnExecution: action.payload.turnExecution,
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
    case 'interrupt/succeeded': {
      const nextTurnExecution = createTurnStartedExecution({
        turnId: action.payload.turnExecution.activeTurnId,
        turnLifecycle: action.payload.turnExecution.turnLifecycle,
      });
      return {
        ...state,
        turnExecution: nextTurnExecution,
        errorMessage: '',
        errorDetail: null,
      };
    }
    case 'send/succeeded': {
      const nextTurnExecution = createTurnStartedExecution({
        turnId: action.payload.turnExecution.activeTurnId,
        turnLifecycle: action.payload.turnExecution.turnLifecycle,
      });
      return {
        ...state,
        threadId: action.payload.threadId,
        turnExecution: nextTurnExecution,
        messages: upsertMessage(state.messages, {
          id: createCanonicalUserMessageId({ turnId: action.payload.turnExecution.activeTurnId }),
          kind: 'message',
          itemType: 'userMessage',
          role: 'user',
          text: action.acceptedText,
          state: 'complete',
          threadId: action.payload.threadId,
          turnId: action.payload.turnExecution.activeTurnId,
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
        errorMessage: action.errorMessage,
        errorDetail: null,
      };
    default:
      return state;
  }
}
