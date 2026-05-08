import {
  cloneMessage,
  reconcileOptimisticUserMessage,
  removePendingRequest,
  upsertPendingRequest,
  upsertSessionItem,
  upsertSessionNotice,
} from '../shared/chat-session-state.js';
import {
  markRuntimeTurnCompleted,
  markRuntimeTurnFailed,
  markRuntimeTurnInterrupted,
  markRuntimeTurnStreaming,
} from '../shared/chat-turn-lifecycle.js';
import { serializeSessionTurnExecution } from '@my-code-x/contracts';
import { cloneCodexRuntimeError } from '../../../common/codex/codex-runtime-error.js';
import { applyTimelineItemDelta, getAssistantMessage } from './chat-event-applier.timeline.js';
import { parseCodexTerminalTurnLifecycle } from '../../../common/codex/derive-codex-turn-lifecycle.js';
import type { ChatEventEmitter, ChatSessionRegistry, ChatSessionState } from '../shared/chat-types.js';
import type { LooseRecord } from '../../../common/codex/codex-types.js';

function emitRuntimeEvent(runtime: ChatSessionState, emitter: ChatEventEmitter, payload: LooseRecord) {
  emitter.emitEvent({ slotId: runtime.slotId, threadId: runtime.threadId }, payload);
}

function createPublicTurnExecution(runtime: ChatSessionState, fieldName: string) {
  return serializeSessionTurnExecution(runtime.turnExecution, {
    fieldName,
  });
}

function applyAgentMessageDelta(runtime: ChatSessionState, event: LooseRecord, now: () => string, emitter: ChatEventEmitter) {
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

function applyTurnStarted(runtime: ChatSessionState, event: LooseRecord, now: () => string, emitter: ChatEventEmitter) {
  markRuntimeTurnStreaming(runtime, event.turnId ?? runtime.turnExecution.activeTurnId);
  runtime.lastUpdatedAt = now();
  emitRuntimeEvent(runtime, emitter, {
    type: 'turn_started',
    threadId: runtime.threadId,
    turnExecution: createPublicTurnExecution(runtime, 'turn started event.turnExecution'),
  });
}

function applyItemCompleted(runtime: ChatSessionState, event: LooseRecord, now: () => string, emitter: ChatEventEmitter) {
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

function applyTimelineItemUpdated(runtime: ChatSessionState, event: LooseRecord, now: () => string, emitter: ChatEventEmitter) {
  const reconciledItem = reconcileOptimisticUserMessage(runtime.messages, event.item);
  upsertSessionItem(runtime.messages, reconciledItem);
  if (reconciledItem.state === 'streaming') {
    markRuntimeTurnStreaming(runtime, event.turnId ?? runtime.turnExecution.activeTurnId);
  }
  runtime.lastUpdatedAt = now();
  emitter.emitTimelineItemUpdated(runtime, reconciledItem);
}

function applyTimelineItemDeltaEvent(runtime: ChatSessionState, event: LooseRecord, now: () => string, emitter: ChatEventEmitter) {
  const item = applyTimelineItemDelta(runtime, event as LooseRecord & { itemId: string; itemType: string });
  markRuntimeTurnStreaming(runtime, event.turnId ?? runtime.turnExecution.activeTurnId);
  runtime.lastUpdatedAt = now();
  emitter.emitTimelineItemUpdated(runtime, item);
}

function applySessionMetaUpdated(runtime: ChatSessionState, event: LooseRecord, now: () => string, emitter: ChatEventEmitter) {
  runtime.threadName = event.threadName ?? runtime.threadName;
  runtime.threadStatus = event.threadStatus ?? runtime.threadStatus;
  runtime.threadStatusText = event.threadStatusText ?? runtime.threadStatusText;
  runtime.tokenUsageText = event.tokenUsageText ?? runtime.tokenUsageText;
  runtime.lastUpdatedAt = now();
  emitter.emitSessionMetaUpdated(runtime);
}

function applySystemNotice(runtime: ChatSessionState, event: LooseRecord, now: () => string, emitter: ChatEventEmitter) {
  upsertSessionNotice(runtime.notices, event.notice);
  runtime.lastUpdatedAt = now();
  emitter.emitSystemNotice(runtime, event.notice);
}

function applyPendingRequestUpdated(runtime: ChatSessionState, event: LooseRecord, now: () => string, emitter: ChatEventEmitter) {
  upsertPendingRequest(runtime.pendingRequests, event.request);
  runtime.lastUpdatedAt = now();
  emitter.emitPendingRequestUpdated(runtime, event.request);
}

function applyPendingRequestResolved(
  runtime: ChatSessionState,
  event: LooseRecord,
  now: () => string,
  emitter: ChatEventEmitter,
  registry: ChatSessionRegistry,
) {
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

function applyTurnCompleted(runtime: ChatSessionState, event: LooseRecord, now: () => string, emitter: ChatEventEmitter) {
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

function applyError(runtime: ChatSessionState, event: LooseRecord, now: () => string, emitter: ChatEventEmitter) {
  runtime.lastError = cloneCodexRuntimeError(event.error);
  runtime.lastUpdatedAt = now();
  emitRuntimeEvent(runtime, emitter, {
    type: 'error',
    threadId: runtime.threadId,
    turnId: event.turnId ?? null,
    error: cloneCodexRuntimeError(event.error),
  });
}

const EVENT_APPLIERS: Record<string, (...args: any[]) => void> = {
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

export function applyGatewayEventToRuntime(
  runtime: ChatSessionState,
  event: LooseRecord,
  { now, emitter, registry }: { now: () => string; emitter: ChatEventEmitter; registry: ChatSessionRegistry },
) {
  const applyEvent = EVENT_APPLIERS[event.type];

  if (!applyEvent) {
    return;
  }

  applyEvent(runtime, event, now, emitter, registry);
}
