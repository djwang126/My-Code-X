import { createChatEventsSnapshotPayload } from '../contracts/chat.contract.js';
import { serializeTimelineItemForPublic } from '../contracts/timeline-item.contract.js';
import { createHttpError } from '../../../common/errors/http-error.js';
import { getRequestUrl, sendRouteError, sendValidationError } from '../../../common/http/route-helpers.js';
import { serializeSessionTurnExecution } from '@my-code-x/contracts';
const STREAM_DEBUG_ENABLED = process.env.MY_CODE_X_DEBUG_STREAM_TIMING === '1' || process.env.MY_CODE_X_DEBUG_STREAM_TIMING === 'true';
const STREAM_HEARTBEAT_MS = Number.parseInt(process.env.MY_CODE_X_SSE_HEARTBEAT_MS || '15000', 10);
function logStreamDebug(stage, details = {}) {
    if (!STREAM_DEBUG_ENABLED) {
        return;
    }
    const payload = {
        ts: new Date().toISOString(),
        scope: 'sse',
        stage,
        ...details,
    };
    process.stdout.write(`[my-code-x-debug] ${JSON.stringify(payload)}\n`);
}
function writeSseEvent(response, eventName, payload) {
    const data = JSON.stringify(payload);
    const firstWriteOk = response.write(`event: ${eventName}
`);
    const secondWriteOk = response.write(`data: ${data}

`);
    return firstWriteOk && secondWriteOk;
}
function isHiddenLargeTimelineDelta(event) {
    return (event?.type === 'timeline_item_delta' &&
        (event.deltaField === 'aggregatedOutput' || event.deltaField === 'output'));
}
function serializeChatEventForPublic(event) {
    if (isHiddenLargeTimelineDelta(event)) {
        return null;
    }
    if (event?.type !== 'timeline_item_updated' || !event.item) {
        return event;
    }
    return {
        ...event,
        item: serializeTimelineItemForPublic(event.item),
    };
}
function readEventDebugTurnId(event) {
    if (!event || typeof event !== 'object') {
        return null;
    }
    if ('turnId' in event) {
        return event.turnId ?? null;
    }
    if ('turnExecution' in event) {
        return event.turnExecution?.activeTurnId ?? null;
    }
    return null;
}
export function handleChatEventsRoute(request, response, { chatService }) {
    const url = getRequestUrl(request);
    const slotId = String(url.searchParams.get('slotId') || '').trim();
    const threadId = String(url.searchParams.get('threadId') || '').trim();
    if (!slotId) {
        sendValidationError(response, 'slotId is required');
        return;
    }
    if (!threadId) {
        sendValidationError(response, 'threadId is required');
        return;
    }
    const runtime = chatService.getSessionState({ slotId, threadId });
    if (!runtime) {
        sendRouteError(response, createHttpError('thread not found', 404));
        return;
    }
    response.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Content-Encoding': 'identity',
    });
    response.flushHeaders?.();
    const turnExecution = serializeSessionTurnExecution(runtime.turnExecution, {
        fieldName: 'chat events route session turn execution',
    });
    logStreamDebug('connect', {
        slotId,
        threadId,
        messageCount: Array.isArray(runtime.messages) ? runtime.messages.length : 0,
        turnLifecycle: turnExecution.turnLifecycle,
    });
    const snapshotWriteOk = writeSseEvent(response, 'snapshot', createChatEventsSnapshotPayload(runtime));
    logStreamDebug('snapshot_written', {
        slotId,
        threadId,
        writeOk: snapshotWriteOk,
        messageCount: Array.isArray(runtime.messages) ? runtime.messages.length : 0,
        turnLifecycle: turnExecution.turnLifecycle,
    });
    const unsubscribe = chatService.subscribe({ slotId, threadId }, (event) => {
        const publicEvent = serializeChatEventForPublic(event);
        if (!publicEvent) {
            logStreamDebug('event_skipped', {
                slotId,
                threadId,
                eventType: event.type,
                turnId: readEventDebugTurnId(event),
                itemId: event.item?.id ?? event.messageId ?? event.request?.id ?? null,
            });
            return;
        }
        const writeOk = writeSseEvent(response, event.type, publicEvent);
        logStreamDebug('event_written', {
            slotId,
            threadId,
            eventType: event.type,
            turnId: readEventDebugTurnId(event),
            itemId: event.item?.id ?? event.messageId ?? event.request?.id ?? null,
            writeOk,
        });
    });
    const heartbeatInterval = Number.isFinite(STREAM_HEARTBEAT_MS) && STREAM_HEARTBEAT_MS > 0
        ? setInterval(() => {
            const writeOk = response.write(`: keepalive ${Date.now()}\n\n`);
            logStreamDebug('heartbeat_written', {
                slotId,
                threadId,
                writeOk,
            });
        }, STREAM_HEARTBEAT_MS)
        : null;
    heartbeatInterval?.unref?.();
    response.on('drain', () => {
        logStreamDebug('drain', {
            slotId,
            threadId,
        });
    });
    request.on('close', () => {
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
        }
        unsubscribe?.();
        logStreamDebug('disconnect', {
            slotId,
            threadId,
        });
        response.end();
    });
}
//# sourceMappingURL=chat-events.controller.js.map