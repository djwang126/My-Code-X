import { serializeChatTurn } from '@my-code-x/contracts';
import type { RuntimeOptions, RuntimePreferences } from '../../common/codex/codex-types.js';
import { buildChatEventsUrl, serializeTimelineItemsForBootstrap } from '../chat/index.js';
import type { ChatSessionState } from '../chat/shared/chat-types.js';

export function createSessionBootstrapPayload({
  viewerId,
  slotId,
  sessionState,
  serverInstanceId,
  authRequired,
  preferences = {},
  options = {},
}: {
  viewerId: string;
  slotId: string;
  sessionState: ChatSessionState;
  serverInstanceId: string;
  authRequired: boolean;
  preferences?: RuntimePreferences;
  options?: RuntimeOptions;
}) {
  const promptOverride = sessionState.appliedThreadRuntimeOverrides?.promptOverride;
  const latestTurn = serializeChatTurn(sessionState.latestTurn, {
    fieldName: 'session bootstrap latestTurn',
  });

  return {
    server: { ok: true, serverInstanceId, authRequired },
    viewer: { viewerId, slotId },
    session: {
      workspace: sessionState.workspace || '',
      threadId: sessionState.threadId,
      latestTurn,
      ...(sessionState.collaborationModeKind ? { collaborationModeKind: sessionState.collaborationModeKind } : {}),
      ...(sessionState.appliedThreadRuntimeOverrides &&
      Object.prototype.hasOwnProperty.call(sessionState.appliedThreadRuntimeOverrides, 'promptOverride')
        ? { promptOverride }
        : {}),
      lastUpdatedAt: sessionState.lastUpdatedAt,
      threadName: sessionState.threadName,
      threadStatus: sessionState.threadStatus,
      threadStatusText: sessionState.threadStatusText,
      tokenUsageText: sessionState.tokenUsageText,
      lastError: sessionState.lastError,
    },
    conversation: {
      messages: serializeTimelineItemsForBootstrap(sessionState.messages),
    },
    stream: {
      url: sessionState.threadId ? buildChatEventsUrl({ slotId, threadId: sessionState.threadId }) : '',
    },
    preferences,
    options,
    notices: sessionState.notices,
    pendingRequests: sessionState.pendingRequests,
  };
}
