import { cloneMessage, cloneNotice, clonePendingRequest, cloneThreadStatus } from '../shared/chat-session-state.js';
export function createChatEventBus() {
    const subscribers = new Set();
    function emitEvent({ slotId, threadId }, event) {
        for (const subscriber of subscribers) {
            if (subscriber.slotId !== slotId) {
                continue;
            }
            if (subscriber.threadId && subscriber.threadId !== threadId) {
                continue;
            }
            subscriber.listener(event);
        }
    }
    function emitTimelineItemUpdated(runtime, item) {
        emitEvent({ slotId: runtime.slotId, threadId: runtime.threadId }, { type: 'timeline_item_updated', threadId: runtime.threadId, turnId: item.turnId, item: cloneMessage(item) });
    }
    function emitSessionMetaUpdated(runtime) {
        emitEvent({ slotId: runtime.slotId, threadId: runtime.threadId }, {
            type: 'session_meta_updated',
            threadId: runtime.threadId,
            threadName: runtime.threadName,
            threadStatus: cloneThreadStatus(runtime.threadStatus),
            threadStatusText: runtime.threadStatusText,
            tokenUsageText: runtime.tokenUsageText,
        });
    }
    function emitSystemNotice(runtime, notice) {
        emitEvent({ slotId: runtime.slotId, threadId: runtime.threadId }, { type: 'system_notice', threadId: runtime.threadId, notice: cloneNotice(notice) });
    }
    function emitPendingRequestUpdated(runtime, request) {
        emitEvent({ slotId: runtime.slotId, threadId: runtime.threadId }, { type: 'pending_request_updated', threadId: runtime.threadId, request: clonePendingRequest(request) });
    }
    function emitPendingRequestResolved(runtime, requestId, notice) {
        emitEvent({ slotId: runtime.slotId, threadId: runtime.threadId }, { type: 'pending_request_resolved', threadId: runtime.threadId, requestId, notice: cloneNotice(notice) });
    }
    function subscribe({ slotId, threadId }, listener) {
        const subscriber = { slotId, threadId, listener };
        subscribers.add(subscriber);
        return () => {
            subscribers.delete(subscriber);
        };
    }
    return {
        emitEvent,
        emitTimelineItemUpdated,
        emitSessionMetaUpdated,
        emitSystemNotice,
        emitPendingRequestUpdated,
        emitPendingRequestResolved,
        subscribe,
    };
}
//# sourceMappingURL=chat-session-event-bus.js.map