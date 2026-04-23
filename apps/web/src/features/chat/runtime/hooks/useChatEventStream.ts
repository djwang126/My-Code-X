import { useEffect } from 'react';

import { useChatRuntimeDispatch } from '../components/ChatRuntimeProvider';
import { isCurrentPageSlotOwner } from '../../../session';
import type { ChatRuntimeState } from '../state/chat-runtime-state';
import type { SessionState as SessionShellState } from '../../../session/public-types';
import { logClientStreamDebug } from './session-event-stream/debug';
import { useAssistantDeltaBatcher } from './session-event-stream/assistant-delta-batcher';
import { createSessionEventHandlers } from './session-event-stream/event-handlers';
import { useSessionStreamVisibility } from './session-event-stream/visibility';
import { isTurnExecutionActive } from '../state/session-turn-lifecycle';

export function useChatEventStream(state: ChatRuntimeState, sessionState: SessionShellState) {
  const dispatch = useChatRuntimeDispatch();
  const { isDocumentVisible, hiddenStreamRevision } = useSessionStreamVisibility(state.streamRevision);
  const { bufferAssistantDelta, flushAssistantDeltas, resetAssistantDeltaBuffer } = useAssistantDeltaBatcher(dispatch);
  const turnActive = isTurnExecutionActive(state.turnExecution);

  useEffect(() => {
    if (sessionState.phase !== 'ready') {
      return;
    }

    if (!turnActive) {
      return;
    }

    if (!state.streamUrl) {
      return;
    }

    if (typeof EventSource === 'undefined') {
      return;
    }

    if (!isCurrentPageSlotOwner(sessionState.slotId)) {
      return;
    }

    if (!isDocumentVisible) {
      return;
    }

    if (hiddenStreamRevision === state.streamRevision) {
      return;
    }

    const eventSource = new EventSource(state.streamUrl);
    const handlers = createSessionEventHandlers({
      dispatch,
      flushAssistantDeltas,
      onAssistantDelta: bufferAssistantDelta,
      threadId: state.threadId,
    });

    logClientStreamDebug('connect', {
      threadId: state.threadId,
      streamUrl: state.streamUrl,
      streamRevision: state.streamRevision,
    });

    eventSource.onopen = () => {
      logClientStreamDebug('open', {
        threadId: state.threadId,
        streamUrl: state.streamUrl,
      });
    };

    eventSource.addEventListener('snapshot', handlers.handleSnapshot as EventListener);
    eventSource.addEventListener('session_meta_updated', handlers.handleSessionMetaUpdated as EventListener);
    eventSource.addEventListener('system_notice', handlers.handleSystemNotice as EventListener);
    eventSource.addEventListener('pending_request_updated', handlers.handlePendingRequestUpdated as EventListener);
    eventSource.addEventListener('pending_request_resolved', handlers.handlePendingRequestResolved as EventListener);
    eventSource.addEventListener('timeline_item_updated', handlers.handleTimelineItemUpdated as EventListener);
    eventSource.addEventListener('timeline_item_delta', handlers.handleTimelineItemDelta as EventListener);
    eventSource.addEventListener('assistant_delta', handlers.handleAssistantDelta as EventListener);
    eventSource.addEventListener('turn_started', handlers.handleTurnStarted as EventListener);
    eventSource.addEventListener('message_completed', handlers.handleMessageCompleted as EventListener);
    eventSource.addEventListener('turn_completed', handlers.handleTurnCompleted as EventListener);
    eventSource.addEventListener('error', handlers.handleError);

    return () => {
      logClientStreamDebug('disconnect', {
        threadId: state.threadId,
        streamUrl: state.streamUrl,
      });
      eventSource.removeEventListener('snapshot', handlers.handleSnapshot as EventListener);
      eventSource.removeEventListener('session_meta_updated', handlers.handleSessionMetaUpdated as EventListener);
      eventSource.removeEventListener('system_notice', handlers.handleSystemNotice as EventListener);
      eventSource.removeEventListener('pending_request_updated', handlers.handlePendingRequestUpdated as EventListener);
      eventSource.removeEventListener('pending_request_resolved', handlers.handlePendingRequestResolved as EventListener);
      eventSource.removeEventListener('timeline_item_updated', handlers.handleTimelineItemUpdated as EventListener);
      eventSource.removeEventListener('timeline_item_delta', handlers.handleTimelineItemDelta as EventListener);
      eventSource.removeEventListener('assistant_delta', handlers.handleAssistantDelta as EventListener);
      eventSource.removeEventListener('turn_started', handlers.handleTurnStarted as EventListener);
      eventSource.removeEventListener('message_completed', handlers.handleMessageCompleted as EventListener);
      eventSource.removeEventListener('turn_completed', handlers.handleTurnCompleted as EventListener);
      eventSource.removeEventListener('error', handlers.handleError);
      eventSource.close();

      if (!isDocumentVisible) {
        resetAssistantDeltaBuffer();
        return;
      }

      flushAssistantDeltas();
    };
  }, [
    bufferAssistantDelta,
    dispatch,
    flushAssistantDeltas,
    hiddenStreamRevision,
    isDocumentVisible,
    resetAssistantDeltaBuffer,
    sessionState.phase,
    sessionState.slotId,
    state.streamRevision,
    state.streamUrl,
    state.threadId,
    turnActive,
  ]);
}
