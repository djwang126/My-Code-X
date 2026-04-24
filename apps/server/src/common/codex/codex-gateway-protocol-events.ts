import { normalizeCodexThreadItem } from './codex-gateway-protocol-normalize.js';
import { createRequestResolvedNotice, createSessionMetaEvent, createSystemNoticeEvent } from './codex-gateway-protocol-meta-events.js';
import { mapTimelineDeltaEvent } from './codex-gateway-protocol-timeline-deltas.js';
import { createCodexRuntimeErrorFromTurnError } from './codex-runtime-error.js';
import { normalizeCodexTurnCompleted, normalizeCodexTurnStarted } from './normalize-codex-turn.js';
import type { LooseRecord } from './codex-types.js';

export { mapCodexServerRequestToRuntimeEvent } from './codex-gateway-protocol-pending-requests.js';

function mapAgentMessageDelta(method: string, params: LooseRecord = {}) {
  if (method !== 'item/agentMessage/delta') {
    return null;
  }

  return {
    type: 'agent_message_delta',
    threadId: params.threadId,
    turnId: params.turnId,
    itemId: params.itemId,
    delta: params.delta,
  };
}

function mapAgentMessageCompleted(method: string, params: LooseRecord = {}) {
  if (method !== 'item/completed' || params?.item?.type !== 'agentMessage') {
    return null;
  }

  return {
    type: 'item_completed',
    threadId: params.threadId,
    turnId: params.turnId,
    item: {
      type: 'agentMessage',
      id: params.item.id,
      text: params.item.text || '',
    },
  };
}

function mapThreadItemState(method: string, params: LooseRecord = {}) {
  if (method !== 'item/started' && method !== 'item/completed') {
    return null;
  }

  const normalizedItem = normalizeCodexThreadItem({
    threadId: params?.threadId,
    turnId: params?.turnId ?? null,
    turnStatus: params?.item?.status === 'inProgress' ? 'inProgress' : undefined,
    item: params?.item,
  });

  if (!normalizedItem) {
    return null;
  }

  return {
    type: 'timeline_item_updated',
    threadId: params.threadId,
    turnId: params.turnId,
    item: normalizedItem,
  };
}

function mapTurnEvent(method: string, params: LooseRecord = {}) {
  if (method === 'turn/started') {
    return {
      type: 'turn_started',
      threadId: params?.threadId,
      turnId: params?.turn?.id ?? params?.turnId ?? null,
      turn: normalizeCodexTurnStarted({
        turn: params?.turn,
        threadId: params?.threadId,
        source: 'turn_started',
        fieldName: 'turn started event.turn',
      }),
    };
  }

  if (method === 'turn/completed') {
    return {
      type: 'turn_completed',
      threadId: params.threadId,
      turnId: params.turn?.id ?? null,
      turn: normalizeCodexTurnCompleted({
        turn: params?.turn,
        threadId: params?.threadId,
        source: 'turn_completed',
        fieldName: 'turn completed event.turn',
      }),
    };
  }

  return null;
}

export function mapCodexNotificationToRuntimeEvent(method: string, params: LooseRecord = {}) {
  if (method === 'error') {
    return {
      type: 'error',
      threadId: params?.threadId,
      turnId: params?.turnId ?? null,
      error: createCodexRuntimeErrorFromTurnError({
        error: params?.error,
        willRetry: params?.willRetry,
        threadId: params?.threadId,
        turnId: params?.turnId,
        presentationScope:
          typeof params?.turnId === 'string' && params.turnId ? 'conversation' : 'shared',
        source: 'error_notification',
      }),
    };
  }

  if (method === 'thread/realtime/error') {
    return {
      type: 'error',
      threadId: params?.threadId,
      turnId: null,
      error: createCodexRuntimeErrorFromTurnError({
        error: { message: params?.message || 'codex realtime error' },
        threadId: params?.threadId,
        presentationScope: 'shared',
        source: 'thread_realtime_error',
      }),
    };
  }

  const agentMessageDeltaEvent = mapAgentMessageDelta(method, params);
  if (agentMessageDeltaEvent) {
    return agentMessageDeltaEvent;
  }

  const agentMessageCompletedEvent = mapAgentMessageCompleted(method, params);
  if (agentMessageCompletedEvent) {
    return agentMessageCompletedEvent;
  }

  const timelineDeltaEvent = mapTimelineDeltaEvent(method, params);
  if (timelineDeltaEvent) {
    return timelineDeltaEvent;
  }

  const sessionMetaEvent = createSessionMetaEvent(method, params);
  if (sessionMetaEvent) {
    return sessionMetaEvent;
  }

  if (method === 'serverRequest/resolved') {
    return {
      type: 'pending_request_resolved',
      threadId: params?.threadId || '',
      requestId: String(params?.requestId || ''),
      notice: createRequestResolvedNotice(params),
    };
  }

  const systemNoticeEvent = createSystemNoticeEvent(method, params);
  if (systemNoticeEvent) {
    return systemNoticeEvent;
  }

  const threadItemStateEvent = mapThreadItemState(method, params);
  if (threadItemStateEvent) {
    return threadItemStateEvent;
  }

  const mappedTurnEvent = mapTurnEvent(method, params);
  if (mappedTurnEvent) {
    return mappedTurnEvent;
  }

  return null;
}
