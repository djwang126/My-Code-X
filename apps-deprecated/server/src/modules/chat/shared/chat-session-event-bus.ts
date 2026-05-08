import { cloneMessage, cloneNotice, clonePendingRequest, cloneThreadStatus } from '../shared/chat-session-state.js';
import type { LooseRecord } from '../../../common/codex/codex-types.js';
import type { ChatEventEmitter, ChatPendingRequest, ChatSessionNotice, ChatSessionState, ChatTimelineItem } from './chat-types.js';

type EventSubscriber = {
  slotId: string;
  threadId?: string;
  listener: (event: LooseRecord) => void;
};

export function createChatEventBus(): ChatEventEmitter {
  const subscribers = new Set<EventSubscriber>();

  function emitEvent({ slotId, threadId }: { slotId: string; threadId?: string }, event: LooseRecord) {
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

  function emitTimelineItemUpdated(runtime: ChatSessionState, item: ChatTimelineItem) {
    emitEvent(
      { slotId: runtime.slotId, threadId: runtime.threadId },
      { type: 'timeline_item_updated', threadId: runtime.threadId, turnId: item.turnId, item: cloneMessage(item) },
    );
  }

  function emitSessionMetaUpdated(runtime: ChatSessionState) {
    emitEvent(
      { slotId: runtime.slotId, threadId: runtime.threadId },
      {
        type: 'session_meta_updated',
        threadId: runtime.threadId,
        threadName: runtime.threadName,
        threadStatus: cloneThreadStatus(runtime.threadStatus),
        threadStatusText: runtime.threadStatusText,
        tokenUsageText: runtime.tokenUsageText,
      },
    );
  }

  function emitSystemNotice(runtime: ChatSessionState, notice: ChatSessionNotice) {
    emitEvent(
      { slotId: runtime.slotId, threadId: runtime.threadId },
      { type: 'system_notice', threadId: runtime.threadId, notice: cloneNotice(notice) },
    );
  }

  function emitPendingRequestUpdated(runtime: ChatSessionState, request: ChatPendingRequest) {
    emitEvent(
      { slotId: runtime.slotId, threadId: runtime.threadId },
      { type: 'pending_request_updated', threadId: runtime.threadId, request: clonePendingRequest(request) },
    );
  }

  function emitPendingRequestResolved(runtime: ChatSessionState, requestId: string, notice: ChatSessionNotice) {
    emitEvent(
      { slotId: runtime.slotId, threadId: runtime.threadId },
      { type: 'pending_request_resolved', threadId: runtime.threadId, requestId, notice: cloneNotice(notice) },
    );
  }

  function subscribe({ slotId, threadId }: { slotId: string; threadId?: string }, listener: (event: LooseRecord) => void) {
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
