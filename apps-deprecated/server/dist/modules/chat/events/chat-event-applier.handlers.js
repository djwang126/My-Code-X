import { cloneMessage, reconcileOptimisticUserMessage, removePendingRequest, upsertPendingRequest, upsertSessionItem, upsertSessionNotice, } from '../shared/chat-session-state.js';
import { markRuntimeTurnCompleted, markRuntimeTurnFailed, markRuntimeTurnInterrupted, markRuntimeTurnStreaming, } from '../shared/chat-turn-lifecycle.js';
import { serializeSessionTurnExecution } from '@my-code-x/contracts';
import { cloneCodexRuntimeError } from '../../../common/codex/codex-runtime-error.js';
import { applyTimelineItemDelta, getAssistantMessage } from './chat-event-applier.timeline.js';
import { parseCodexTerminalTurnLifecycle } from '../../../common/codex/derive-codex-turn-lifecycle.js';
function emitRuntimeEvent(runtime, emitter, payload) {
    emitter.emitEvent({ slotId: runtime.slotId, threadId: runtime.threadId }, payload);
}
function createPublicTurnExecution(runtime, fieldName) {
    return serializeSessionTurnExecution(runtime.turnExecution, {
        fieldName,
    });
}
function applyAgentMessageDelta(runtime, event, now, emitter) {
    const message = getAssistantMessage(runtime, event.itemId);
    message.text += event.delta;
    message.state = 'streaming';
    message.turnId = event.turnId;
    message.raw = {
        type: 'agentMessage',
        id: message.id,
        text: message.text,
    };
    markRuntimeTurnStreaming(runtime, event.turnId);
    runtime.lastUpdatedAt = now();
    emitRuntimeEvent(runtime, emitter, {
        type: 'assistant_delta',
        threadId: runtime.threadId,
        turnId: event.turnId,
        messageId: message.id,
        delta: event.delta,
        text: message.text,
    });
}
function applyTurnStarted(runtime, event, now, emitter) {
    markRuntimeTurnStreaming(runtime, event.turnId ?? runtime.turnExecution.activeTurnId);
    runtime.lastUpdatedAt = now();
    emitRuntimeEvent(runtime, emitter, {
        type: 'turn_started',
        threadId: runtime.threadId,
        turnExecution: createPublicTurnExecution(runtime, 'turn started event.turnExecution'),
    });
}
function applyItemCompleted(runtime, event, now, emitter) {
    if (event.item?.type !== 'agentMessage') {
        return;
    }
    const message = getAssistantMessage(runtime, event.item.id);
    message.text = event.item.text;
    message.state = 'complete';
    message.turnId = event.turnId;
    message.raw = {
        ...event.item,
    };
    runtime.lastUpdatedAt = now();
    emitRuntimeEvent(runtime, emitter, {
        type: 'message_completed',
        threadId: runtime.threadId,
        turnId: event.turnId,
        message: cloneMessage(message),
    });
}
function applyTimelineItemUpdated(runtime, event, now, emitter) {
    const reconciledItem = reconcileOptimisticUserMessage(runtime.messages, event.item);
    upsertSessionItem(runtime.messages, reconciledItem);
    if (reconciledItem.state === 'streaming') {
        markRuntimeTurnStreaming(runtime, event.turnId ?? runtime.turnExecution.activeTurnId);
    }
    runtime.lastUpdatedAt = now();
    emitter.emitTimelineItemUpdated(runtime, reconciledItem);
}
function applyTimelineItemDeltaEvent(runtime, event, now, emitter) {
    const item = applyTimelineItemDelta(runtime, event);
    markRuntimeTurnStreaming(runtime, event.turnId ?? runtime.turnExecution.activeTurnId);
    runtime.lastUpdatedAt = now();
    emitter.emitTimelineItemUpdated(runtime, item);
}
function applySessionMetaUpdated(runtime, event, now, emitter) {
    runtime.threadName = event.threadName ?? runtime.threadName;
    runtime.threadStatus = event.threadStatus ?? runtime.threadStatus;
    runtime.threadStatusText = event.threadStatusText ?? runtime.threadStatusText;
    runtime.tokenUsageText = event.tokenUsageText ?? runtime.tokenUsageText;
    runtime.lastUpdatedAt = now();
    emitter.emitSessionMetaUpdated(runtime);
}
function applySystemNotice(runtime, event, now, emitter) {
    upsertSessionNotice(runtime.notices, event.notice);
    runtime.lastUpdatedAt = now();
    emitter.emitSystemNotice(runtime, event.notice);
}
function applyPendingRequestUpdated(runtime, event, now, emitter) {
    upsertPendingRequest(runtime.pendingRequests, event.request);
    runtime.lastUpdatedAt = now();
    emitter.emitPendingRequestUpdated(runtime, event.request);
}
function applyPendingRequestResolved(runtime, event, now, emitter, registry) {
    const removedRequest = removePendingRequest(runtime.pendingRequests, event.requestId);
    if (!removedRequest) {
        return;
    }
    if (!event.threadId) {
        registry.deleteThreadlessRequestOwner(event.requestId);
    }
    upsertSessionNotice(runtime.notices, event.notice);
    runtime.lastUpdatedAt = now();
    emitter.emitPendingRequestResolved(runtime, event.requestId, event.notice);
}
function applyTurnCompleted(runtime, event, now, emitter) {
    const turnLifecycle = parseCodexTerminalTurnLifecycle(event.turn.status, {
        fieldName: 'turn completed event.turn.status',
    });
    switch (turnLifecycle) {
        case 'completed':
            markRuntimeTurnCompleted(runtime, event.turn.id);
            break;
        case 'interrupted':
            markRuntimeTurnInterrupted(runtime, event.turn.id);
            break;
        case 'failed':
            markRuntimeTurnFailed(runtime, event.turn.id);
            break;
    }
    runtime.lastError = cloneCodexRuntimeError(event.turn.error);
    runtime.lastUpdatedAt = now();
    emitRuntimeEvent(runtime, emitter, {
        type: 'turn_completed',
        threadId: runtime.threadId,
        turnExecution: createPublicTurnExecution(runtime, 'turn completed event.turnExecution'),
        error: cloneCodexRuntimeError(runtime.lastError),
    });
}
function applyError(runtime, event, now, emitter) {
    runtime.lastError = cloneCodexRuntimeError(event.error);
    runtime.lastUpdatedAt = now();
    emitRuntimeEvent(runtime, emitter, {
        type: 'error',
        threadId: runtime.threadId,
        turnId: event.turnId ?? null,
        error: cloneCodexRuntimeError(event.error),
    });
}
const EVENT_APPLIERS = {
    agent_message_delta: applyAgentMessageDelta,
    turn_started: applyTurnStarted,
    item_completed: applyItemCompleted,
    timeline_item_updated: applyTimelineItemUpdated,
    timeline_item_delta: applyTimelineItemDeltaEvent,
    session_meta_updated: applySessionMetaUpdated,
    system_notice: applySystemNotice,
    pending_request_updated: applyPendingRequestUpdated,
    pending_request_resolved: applyPendingRequestResolved,
    turn_completed: applyTurnCompleted,
    error: applyError,
};
export function applyGatewayEventToRuntime(runtime, event, { now, emitter, registry }) {
    const applyEvent = EVENT_APPLIERS[event.type];
    if (!applyEvent) {
        return;
    }
    applyEvent(runtime, event, now, emitter, registry);
}
//# sourceMappingURL=chat-event-applier.handlers.js.map