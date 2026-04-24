import type { ChatMessage, SessionPayload, SessionStreamAssistantDelta, SessionTimelineItem } from '../session-types';
import { readOptionalCollaborationModeKind } from '../../../../shared/lib/collaboration-mode';
import { applySessionRuntimeMetadata, readRuntimeSettings } from '../../settings';
import type { ChatRuntimeState } from './chat-runtime-state';
import { normalizeNotices, normalizePendingRequests, normalizeTimelineItems, upsertMessage } from './session-collections';
import { applyConversationScopedTurnError, getSharedErrorMessage } from './session-error-routing';

export function withPreferencesSessionRuntimeMetadata(
  preferences: SessionPayload['preferences'],
  { collaborationModeKind, promptOverride }: { collaborationModeKind: unknown; promptOverride: unknown },
): SessionPayload['preferences'] {
  const nextRuntimeSettings = applySessionRuntimeMetadata(readRuntimeSettings(preferences), {
    collaborationModeKind,
    promptOverride,
  });

  return nextRuntimeSettings ?? preferences;
}

export function readCurrentCollaborationModeKind(preferences: SessionPayload['preferences']) {
  return readRuntimeSettings(preferences)?.collaborationModeKind ?? null;
}

export function createHydratedChatRuntimeState(payload: SessionPayload, state: ChatRuntimeState): ChatRuntimeState {
  const collaborationModeKind =
    readRuntimeSettings(payload.preferences)?.collaborationModeKind ??
    readOptionalCollaborationModeKind(payload.session.collaborationModeKind) ??
    null;
  const normalizedMessages = applyConversationScopedTurnError(
    normalizeTimelineItems(payload.conversation.messages),
    payload.session.lastError,
  );

  return {
    ...state,
    workspace: payload.session.workspace,
    threadId: payload.session.threadId,
    latestTurn: payload.session.latestTurn,
    operations: {
      send: 'idle',
      interrupt: 'idle',
    },
    threadName: payload.session.threadName || '',
    threadStatus: payload.session.threadStatus ?? null,
    threadStatusText: payload.session.threadStatusText || '',
    tokenUsageText: payload.session.tokenUsageText || '',
    statusMessage: payload.session.threadStatusText || 'Session synced',
    errorMessage: getSharedErrorMessage(payload.session.lastError),
    errorDetail: payload.session.lastError ?? null,
    messages: normalizedMessages,
    notices: normalizeNotices(payload.notices),
    pendingRequests: normalizePendingRequests(payload.pendingRequests),
    streamUrl: payload.stream.url,
    streamRevision: state.streamRevision + 1,
    preferences: withPreferencesSessionRuntimeMetadata(payload.preferences, {
      collaborationModeKind,
      promptOverride: payload.session.promptOverride,
    }),
    options: payload.options,
  };
}

function applyAssistantDelta(
  messages: SessionTimelineItem[],
  payload: SessionStreamAssistantDelta,
): SessionTimelineItem[] {
  const existing = messages.find(message => message.id === payload.messageId);
  const nextMessage: ChatMessage = existing
    ? {
        ...existing,
        kind: 'message',
        itemType: 'agentMessage',
        role: 'assistant',
        text: payload.text,
        state: 'streaming',
        threadId: payload.threadId,
        turnId: payload.turnId,
      }
    : {
        id: payload.messageId,
        kind: 'message',
        itemType: 'agentMessage',
        role: 'assistant',
        text: payload.text,
        state: 'streaming',
        threadId: payload.threadId,
        turnId: payload.turnId,
      };

  return upsertMessage(messages, nextMessage);
}

export function applyAssistantDeltas(
  messages: SessionTimelineItem[],
  payloads: SessionStreamAssistantDelta[],
): SessionTimelineItem[] {
  let nextMessages = messages;

  for (const payload of payloads) {
    nextMessages = applyAssistantDelta(nextMessages, payload);
  }

  return nextMessages;
}
