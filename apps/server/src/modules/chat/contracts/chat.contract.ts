import { serializeChatTurn } from '@my-code-x/contracts';
import { serializeTimelineItemsForPublic } from './timeline-item.contract.js';
export function buildChatEventsUrl({ slotId, threadId }: any) {
    return `/api/v2/chat/events?slotId=${encodeURIComponent(slotId)}&threadId=${encodeURIComponent(threadId)}`;
}
export function createChatMessageAcceptedPayload({ slotId, result }: any) {
    const turn = serializeChatTurn(result.turn, {
        fieldName: 'chat message accepted payload.turn',
    });
    return {
        threadId: result.threadId,
        turn,
        stream: {
            url: buildChatEventsUrl({ slotId, threadId: result.threadId }),
        },
    };
}
export function createChatEventsSnapshotPayload(runtime: any) {
    const latestTurn = serializeChatTurn(runtime.latestTurn, {
        fieldName: 'chat events snapshot.latestTurn',
    });
    return {
        threadId: runtime.threadId,
        latestTurn,
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
