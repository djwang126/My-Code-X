import type {
  SessionStreamAssistantDelta,
  SessionStreamError,
  SessionStreamMessageCompleted,
  SessionStreamPendingRequestResolved,
  SessionStreamPendingRequestUpdated,
  SessionStreamSessionMetaUpdated,
  SessionStreamSystemNotice,
  SessionStreamTimelineItemUpdated,
  SessionStreamTurnStarted,
  SessionStreamTurnCompleted,
} from '../../session-types';
import type { ChatRuntimeAction, ChatRuntimeState } from '../../state/chat-runtime-state';
import { logClientStreamDebug } from './debug';
import { parseEventData } from './event-data';
import {
  dispatchInvalidStreamPayload,
  dispatchParsedStreamEvent,
} from './event-handler-shared';
import {
  parseSessionStreamAssistantDelta,
  parseSessionStreamError,
  parseSessionStreamMessageCompleted,
  parseSessionStreamPendingRequestResolved,
  parseSessionStreamPendingRequestUpdated,
  parseSessionStreamSessionMetaUpdated,
  parseSessionStreamSnapshot,
  parseSessionStreamSystemNotice,
  parseSessionStreamTimelineItemDelta,
  parseSessionStreamTimelineItemUpdated,
  parseSessionStreamTurnStarted,
  parseSessionStreamTurnCompleted,
} from '../../lib/session-payload-parse';

type Dispatch = React.Dispatch<ChatRuntimeAction>;

type CreateSessionEventHandlersInput = {
  dispatch: Dispatch;
  flushAssistantDeltas: () => void;
  onAssistantDelta: (payload: SessionStreamAssistantDelta) => void;
  threadId: ChatRuntimeState['threadId'];
};

export function createSessionEventHandlers({
  dispatch,
  flushAssistantDeltas,
  onAssistantDelta,
  threadId,
}: CreateSessionEventHandlersInput) {
  const handleSnapshot = (event: MessageEvent<string>) => {
    dispatchParsedStreamEvent({
      dispatch,
      event,
      eventName: 'snapshot',
      flushAssistantDeltas,
      parsePayload: parseSessionStreamSnapshot,
      threadId,
      handlePayload: payload => {
        logClientStreamDebug('snapshot_received', {
          threadId: payload.threadId,
          activeTurnId: payload.turnExecution.activeTurnId,
          turnLifecycle: payload.turnExecution.turnLifecycle,
          messageCount: Array.isArray(payload.messages) ? payload.messages.length : 0,
        });
        dispatch({ type: 'stream/snapshot', payload });
      },
    });
  };

  const handleAssistantDelta = (event: MessageEvent<string>) => {
    try {
      const payload = parseSessionStreamAssistantDelta(parseEventData(event.data));
      logClientStreamDebug('assistant_delta_received', {
        threadId: payload.threadId,
        turnId: payload.turnId,
        messageId: payload.messageId,
        textLength: payload.text?.length ?? 0,
        deltaLength: payload.delta?.length ?? 0,
      });
      onAssistantDelta(payload);
    } catch (error) {
      dispatchInvalidStreamPayload(dispatch, threadId, 'assistant_delta', error);
    }
  };

  const handleTurnStarted = (event: MessageEvent<string>) => {
    dispatchParsedStreamEvent({
      dispatch,
      event,
      eventName: 'turn_started',
      flushAssistantDeltas,
      parsePayload: parseSessionStreamTurnStarted,
      threadId,
      handlePayload: (payload: SessionStreamTurnStarted) => {
        logClientStreamDebug('turn_started_received', {
          threadId: payload.threadId,
          turnId: payload.turnExecution.activeTurnId,
          turnLifecycle: payload.turnExecution.turnLifecycle,
        });
        dispatch({ type: 'stream/turn-started', payload });
      },
    });
  };

  const handleTimelineItemUpdated = (event: MessageEvent<string>) => {
    dispatchParsedStreamEvent({
      dispatch,
      event,
      eventName: 'timeline_item_updated',
      flushAssistantDeltas,
      parsePayload: parseSessionStreamTimelineItemUpdated,
      threadId,
      handlePayload: (payload: SessionStreamTimelineItemUpdated) => {
        logClientStreamDebug('timeline_item_received', {
          threadId: payload.threadId,
          turnId: payload.turnId,
          itemId: payload.item?.id,
          itemType: payload.item?.itemType,
          state: payload.item?.state,
        });
        dispatch({ type: 'stream/timeline-item-updated', payload });
      },
    });
  };

  const handleTimelineItemDelta = (event: MessageEvent<string>) => {
    dispatchParsedStreamEvent({
      dispatch,
      event,
      eventName: 'timeline_item_delta',
      flushAssistantDeltas,
      parsePayload: parseSessionStreamTimelineItemDelta,
      threadId,
      handlePayload: payload => {
        if (payload.deltaField === 'aggregatedOutput' || payload.deltaField === 'output') {
          return;
        }

        dispatch({ type: 'stream/timeline-item-delta', payload });
      },
    });
  };

  const handleSessionMetaUpdated = (event: MessageEvent<string>) => {
    dispatchParsedStreamEvent({
      dispatch,
      event,
      eventName: 'session_meta_updated',
      flushAssistantDeltas,
      parsePayload: parseSessionStreamSessionMetaUpdated,
      threadId,
      handlePayload: (payload: SessionStreamSessionMetaUpdated) => dispatch({ type: 'stream/session-meta-updated', payload }),
    });
  };

  const handleSystemNotice = (event: MessageEvent<string>) => {
    dispatchParsedStreamEvent({
      dispatch,
      event,
      eventName: 'system_notice',
      flushAssistantDeltas,
      parsePayload: parseSessionStreamSystemNotice,
      threadId,
      handlePayload: (payload: SessionStreamSystemNotice) => dispatch({ type: 'stream/system-notice', payload }),
    });
  };

  const handlePendingRequestUpdated = (event: MessageEvent<string>) => {
    dispatchParsedStreamEvent({
      dispatch,
      event,
      eventName: 'pending_request_updated',
      flushAssistantDeltas,
      parsePayload: parseSessionStreamPendingRequestUpdated,
      threadId,
      handlePayload: (payload: SessionStreamPendingRequestUpdated) => dispatch({ type: 'stream/pending-request-updated', payload }),
    });
  };

  const handlePendingRequestResolved = (event: MessageEvent<string>) => {
    dispatchParsedStreamEvent({
      dispatch,
      event,
      eventName: 'pending_request_resolved',
      flushAssistantDeltas,
      parsePayload: parseSessionStreamPendingRequestResolved,
      threadId,
      handlePayload: (payload: SessionStreamPendingRequestResolved) =>
        dispatch({ type: 'stream/pending-request-resolved', payload }),
    });
  };

  const handleMessageCompleted = (event: MessageEvent<string>) => {
    dispatchParsedStreamEvent({
      dispatch,
      event,
      eventName: 'message_completed',
      flushAssistantDeltas,
      parsePayload: parseSessionStreamMessageCompleted,
      threadId,
      handlePayload: (payload: SessionStreamMessageCompleted) => {
        logClientStreamDebug('message_completed_received', {
          threadId: payload.threadId,
          turnId: payload.turnId,
          messageId: payload.message?.id,
        });
        dispatch({ type: 'stream/message-completed', payload });
      },
    });
  };

  const handleTurnCompleted = (event: MessageEvent<string>) => {
    dispatchParsedStreamEvent({
      dispatch,
      event,
      eventName: 'turn_completed',
      flushAssistantDeltas,
      parsePayload: parseSessionStreamTurnCompleted,
      threadId,
      handlePayload: (payload: SessionStreamTurnCompleted) => {
        logClientStreamDebug('turn_completed_received', {
          threadId: payload.threadId,
          turnId: payload.turnExecution.activeTurnId,
          turnLifecycle: payload.turnExecution.turnLifecycle,
        });
        dispatch({ type: 'stream/turn-completed', payload });
      },
    });
  };

  const handleError = (event: Event) => {
    flushAssistantDeltas();
    const rawPayload = parseEventData((event as MessageEvent<string>).data);

    if (rawPayload == null) {
      return;
    }

    try {
      const payload = parseSessionStreamError(rawPayload);

      if (!payload.error) {
        return;
      }

      logClientStreamDebug('error_received', {
        threadId,
        errorMessage: payload.error.message,
      });
      dispatch({ type: 'stream/error', payload: payload as SessionStreamError });
    } catch (error) {
      dispatchInvalidStreamPayload(dispatch, threadId, 'error', error);
    }
  };

  return {
    handleAssistantDelta,
    handleError,
    handleMessageCompleted,
    handlePendingRequestResolved,
    handlePendingRequestUpdated,
    handleSessionMetaUpdated,
    handleSnapshot,
    handleSystemNotice,
    handleTimelineItemDelta,
    handleTimelineItemUpdated,
    handleTurnStarted,
    handleTurnCompleted,
  };
}
