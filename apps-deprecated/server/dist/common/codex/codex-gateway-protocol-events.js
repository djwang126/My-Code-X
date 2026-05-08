import { normalizeCodexThreadItem } from './codex-gateway-protocol-normalize.js';
import { createRequestResolvedNotice, createSessionMetaEvent, createSystemNoticeEvent } from './codex-gateway-protocol-meta-events.js';
import { mapTimelineDeltaEvent } from './codex-gateway-protocol-timeline-deltas.js';
import { createCodexRuntimeErrorFromTurnError } from './codex-runtime-error.js';
export { mapCodexServerRequestToRuntimeEvent } from './codex-gateway-protocol-pending-requests.js';
function mapAgentMessageDelta(method, params = {}) {
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
function mapAgentMessageCompleted(method, params = {}) {
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
function mapThreadItemLifecycle(method, params = {}) {
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
function mapTurnLifecycle(method, params = {}) {
    if (method === 'turn/started') {
        return {
            type: 'turn_started',
            threadId: params?.threadId,
            turnId: params?.turn?.id ?? params?.turnId ?? null,
        };
    }
    if (method === 'turn/completed') {
        return {
            type: 'turn_completed',
            threadId: params.threadId,
            turnId: params.turn?.id ?? null,
            turn: {
                id: params.turn.id,
                status: params.turn.status,
                error: createCodexRuntimeErrorFromTurnError({
                    error: params.turn.error,
                    threadId: params.threadId,
                    turnId: params.turn?.id,
                    presentationScope: 'conversation',
                    source: 'turn_completed',
                }),
            },
        };
    }
    return null;
}
export function mapCodexNotificationToRuntimeEvent(method, params = {}) {
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
                presentationScope: typeof params?.turnId === 'string' && params.turnId ? 'conversation' : 'shared',
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
    const threadItemLifecycleEvent = mapThreadItemLifecycle(method, params);
    if (threadItemLifecycleEvent) {
        return threadItemLifecycleEvent;
    }
    const turnLifecycleEvent = mapTurnLifecycle(method, params);
    if (turnLifecycleEvent) {
        return turnLifecycleEvent;
    }
    return null;
}
//# sourceMappingURL=codex-gateway-protocol-events.js.map