import { serializeSessionTurnExecution } from '@my-code-x/contracts';
import { serializeTimelineItemsForPublic } from './timeline-item.contract.js';
export function buildChatEventsUrl({ slotId, threadId }) {
    return `/api/v2/chat/events?slotId=${encodeURIComponent(slotId)}&threadId=${encodeURIComponent(threadId)}`;
}
export function createChatMessageAcceptedPayload({ slotId, result }) {
    const turnExecution = serializeSessionTurnExecution(result.turnExecution, {
        fieldName: 'chat message accepted payload',
    });
    return {
        threadId: result.threadId,
        turnExecution,
        stream: {
            url: buildChatEventsUrl({ slotId, threadId: result.threadId }),
        },
    };
}
export function createChatEventsSnapshotPayload(runtime) {
    const turnExecution = serializeSessionTurnExecution(runtime.turnExecution, {
        fieldName: 'chat events snapshot',
    });
    return {
        threadId: runtime.threadId,
        turnExecution,
        threadName: runtime.threadName,
        threadStatus: runtime.threadStatus,
        threadStatusText: runtime.threadStatusText,
        tokenUsageText: runtime.tokenUsageText,
        messages: serializeTimelineItemsForPublic(runtime.messages || []),
        notices: runtime.notices || [],
        pendingRequests: runtime.pendingRequests || [],
        lastError: runtime.lastError,
        lastUpdatedAt: runtime.lastUpdatedAt,
    };
}
//# sourceMappingURL=chat.contract.js.map