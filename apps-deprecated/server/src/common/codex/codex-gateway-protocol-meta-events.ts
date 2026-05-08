import { formatStructuredText, formatThreadStatusText, formatTokenUsageText } from './codex-gateway-protocol-normalize.js';
import type { LooseRecord } from './codex-types.js';
const SESSION_META_METHODS = new Set([
    'thread/name/updated',
    'thread/status/changed',
    'thread/tokenUsage/updated',
    'thread/started',
    'thread/archived',
    'thread/unarchived',
    'thread/closed',
]);
export function createSessionMetaEvent(method: string, params: LooseRecord = {}) {
    if (!SESSION_META_METHODS.has(method)) {
        return null;
    }
    const event: LooseRecord = {
        type: 'session_meta_updated',
        threadId: params.threadId ?? params.thread?.id,
    };
    if (method === 'thread/name/updated') {
        event.threadName =
            (typeof params.threadName === 'string' && params.threadName) ||
                (typeof params.name === 'string' && params.name) ||
                (typeof params.thread?.name === 'string' && params.thread?.name) ||
                '';
        return event;
    }
    if (method === 'thread/tokenUsage/updated') {
        event.tokenUsageText = formatTokenUsageText(params.tokenUsage ?? params.usage ?? params);
        return event;
    }
    if (method === 'thread/status/changed') {
        event.threadStatus = params.status ?? null;
        event.threadStatusText = formatThreadStatusText(params.status);
        return event;
    }
    if (method === 'thread/started') {
        event.threadName = typeof params.thread?.name === 'string' ? params.thread.name : '';
        event.threadStatus = params.thread?.status ?? null;
        event.threadStatusText = formatThreadStatusText(params.thread?.status) || 'started';
        return event;
    }
    if (method === 'thread/archived') {
        event.threadStatus = 'archived';
        event.threadStatusText = 'archived';
        return event;
    }
    if (method === 'thread/unarchived') {
        event.threadStatus = 'active';
        event.threadStatusText = 'active';
        return event;
    }
    if (method === 'thread/closed') {
        event.threadStatus = 'closed';
        event.threadStatusText = 'closed';
        return event;
    }
    return null;
}
const SYSTEM_NOTICE_METHODS = new Set([
    'turn/plan/updated',
    'thread/compacted',
    'deprecationNotice',
    'configWarning',
    'windows/worldWritableWarning',
    'account/updated',
    'skills/changed',
    'app/list/updated',
    'fs/changed',
]);
export function createRequestResolvedNotice(params: LooseRecord = {}) {
    return {
        id: `serverRequest/resolved:${params?.requestId || 'latest'}`,
        level: 'info',
        title: 'Request resolved',
        text: params?.requestId ? `Resolved request ${params.requestId}` : 'Pending request resolved',
        raw: params,
    };
}
export function createSystemNoticeEvent(method: string, params: LooseRecord = {}) {
    if (!SYSTEM_NOTICE_METHODS.has(method)) {
        return null;
    }
    let title = method;
    let text = '';
    let level = 'info';
    let idSuffix = '';
    switch (method) {
        case 'turn/plan/updated':
            title = 'Todo list updated';
            text = [
                params?.explanation || '',
                Array.isArray(params?.plan)
                    ? params.plan.map((step: any) => `${step?.status || 'pending'}: ${step?.step || ''}`).filter(Boolean).join(' | ')
                    : '',
            ]
                .filter(Boolean)
                .join(' · ');
            idSuffix = params?.turnId || '';
            break;
        case 'deprecationNotice':
            title = 'Deprecation notice';
            text = params?.message || formatStructuredText(params);
            level = 'warning';
            break;
        case 'configWarning':
            title = 'Config warning';
            text = params?.message || formatStructuredText(params);
            level = 'warning';
            break;
        case 'windows/worldWritableWarning':
            title = 'World-writable warning';
            text = params?.path || params?.message || formatStructuredText(params);
            level = 'warning';
            break;
        default:
            title = method.replaceAll('/', ' ').replaceAll('.', ' ');
            text = params?.message || params?.status || params?.reason || params?.name || '';
            idSuffix = params?.turnId || params?.requestId || params?.itemId || params?.callId || params?.name || '';
            break;
    }
    return {
        type: 'system_notice',
        threadId: params?.threadId,
        notice: {
            id: `${method}:${idSuffix || 'latest'}`,
            level,
            title,
            text: text || title,
            raw: params,
        },
    };
}
