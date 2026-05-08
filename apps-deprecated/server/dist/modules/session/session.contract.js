import { serializeSessionTurnExecution } from '@my-code-x/contracts';
import { buildChatEventsUrl, serializeTimelineItemsForBootstrap } from '../chat/index.js';
export function createSessionBootstrapPayload({ viewerId, slotId, sessionState, serverInstanceId, authRequired, preferences = {}, options = {}, }) {
    const promptOverride = sessionState.appliedThreadRuntimeOverrides?.promptOverride;
    const turnExecution = serializeSessionTurnExecution(sessionState.turnExecution, {
        fieldName: 'session bootstrap',
    });
    return {
        server: { ok: true, serverInstanceId, authRequired },
        viewer: { viewerId, slotId },
        session: {
            workspace: sessionState.workspace || '',
            threadId: sessionState.threadId,
            turnExecution,
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
//# sourceMappingURL=session.contract.js.map