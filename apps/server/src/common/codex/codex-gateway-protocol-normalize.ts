import { createCodexRuntimeErrorFromTurnError } from './codex-runtime-error.js';
import { createCanonicalUserMessageId } from '@my-code-x/contracts';
import { normalizeCodexTurn } from './normalize-codex-turn.js';
import type { LooseRecord } from './codex-types.js';
const SPECIAL_ITEM_TYPES = new Set([
    'hookPrompt',
    'plan',
    'reasoning',
    'commandExecution',
    'fileChange',
    'mcpToolCall',
    'dynamicToolCall',
    'collabAgentToolCall',
    'collabToolCall',
    'webSearch',
    'enteredReviewMode',
    'exitedReviewMode',
    'contextCompaction',
]);
export function normalizeTurnStatus(status: any) {
    if (status === 'inProgress')
        return 'in_progress';
    return status || 'idle';
}
export function formatStructuredText(value: any) {
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    if (value == null) {
        return '';
    }
    try {
        return JSON.stringify(value);
    }
    catch {
        return String(value);
    }
}
function formatTokenUsageBreakdown(label: string, breakdown: LooseRecord = {}) {
    const entries = [
        ['input', breakdown?.inputTokens],
        ['output', breakdown?.outputTokens],
        ['cached', breakdown?.cachedInputTokens],
        ['reasoning', breakdown?.reasoningOutputTokens ?? breakdown?.reasoningTokens],
        ['total', breakdown?.totalTokens],
    ].filter(([, value]) => typeof value === 'number');
    if (!entries.length) {
        return '';
    }
    return `${label}: ${entries.map(([entryLabel, value]: any) => `${entryLabel} ${value}`).join(' · ')}`;
}
export function formatTokenUsageText(params: LooseRecord = {}) {
    const source = (params && typeof params.tokenUsage === 'object' && params.tokenUsage) ||
        (params && typeof params.usage === 'object' && params.usage) ||
        params;
    const breakdownText = [formatTokenUsageBreakdown('last', source?.last), formatTokenUsageBreakdown('total', source?.total)]
        .filter(Boolean)
        .join(' | ');
    if (breakdownText) {
        return breakdownText;
    }
    const entries = [
        ['input', source?.inputTokens],
        ['output', source?.outputTokens],
        ['cached', source?.cachedInputTokens],
        ['reasoning', source?.reasoningOutputTokens ?? source?.reasoningTokens],
        ['total', source?.totalTokens],
    ].filter(([, value]) => typeof value === 'number');
    if (entries.length) {
        return entries.map(([label, value]: any) => `${label}: ${value}`).join(' · ');
    }
    return formatStructuredText(source);
}
export function formatThreadStatusText(status: any) {
    if (typeof status === 'string') {
        return status;
    }
    if (!status || typeof status !== 'object') {
        return '';
    }
    const activeFlags = Array.isArray(status.activeFlags)
        ? status.activeFlags.filter((flag: any) => typeof flag === 'string' && flag)
        : [];
    const typeText = typeof status.type === 'string' ? status.type : '';
    if (typeText && activeFlags.length) {
        return `${typeText} (${activeFlags.join(', ')})`;
    }
    if (typeText) {
        return typeText;
    }
    return formatStructuredText(status);
}
function normalizeTimelineItemState({ turnStatus, itemStatus = undefined, defaultState = 'complete', }: {
    turnStatus?: string;
    itemStatus?: string;
    defaultState?: string;
}) {
    if (itemStatus === 'failed' || itemStatus === 'declined') {
        return 'error';
    }
    if (itemStatus === 'inProgress' || turnStatus === 'inProgress') {
        return 'streaming';
    }
    return defaultState;
}
function formatUserContentItem(item: any) {
    if (item?.type === 'text' && typeof item.text === 'string') {
        return item.text;
    }
    if (item?.type === 'skill') {
        return item.name ? `[skill: ${item.name}]` : '[skill]';
    }
    if (item?.type === 'mention') {
        if (typeof item.name === 'string' && item.name) {
            return `[mention: ${item.name}]`;
        }
        if (typeof item.path === 'string' && item.path) {
            return `[mention: ${item.path}]`;
        }
        return '[mention]';
    }
    if (item?.type === 'image' || item?.type === 'localImage' || item?.type === 'local_image') {
        return `[${item.type}]`;
    }
    return item?.type ? `[${item.type}]` : '';
}
function extractUserMessageText(content: any = []) {
    return content
        .map(formatUserContentItem)
        .join('\n\n');
}
function extractHookPromptText(fragments: any = []) {
    return fragments
        .map((fragment: any) => {
        if (typeof fragment === 'string')
            return fragment;
        if (typeof fragment?.text === 'string')
            return fragment.text;
        if (typeof fragment?.value === 'string')
            return fragment.value;
        return '';
    })
        .filter(Boolean)
        .join('\n');
}
function extractReasoningText(item: any) {
    if (typeof item?.summary === 'string') {
        return item.summary;
    }
    if (Array.isArray(item?.summary)) {
        return item.summary
            .map((entry: any) => {
            if (typeof entry === 'string')
                return entry;
            if (typeof entry?.text === 'string')
                return entry.text;
            return '';
        })
            .filter(Boolean)
            .join('\n');
    }
    if (typeof item?.text === 'string') {
        return item.text;
    }
    return '';
}
function extractSpecialItemText(item: any) {
    switch (item?.type) {
        case 'plan':
            return item.text || '';
        case 'reasoning':
            return extractReasoningText(item);
        case 'commandExecution':
            return item.command || item.aggregatedOutput || '';
        case 'fileChange':
            return Array.isArray(item.changes) ? item.changes.map((change: any) => change?.path).filter(Boolean).join(', ') : '';
        case 'mcpToolCall':
            return [item.server, item.tool].filter(Boolean).join('.');
        case 'dynamicToolCall':
        case 'collabAgentToolCall':
        case 'collabToolCall':
            return item.tool || '';
        case 'webSearch':
            return item.query || '';
        case 'enteredReviewMode':
        case 'exitedReviewMode':
            return item.review || '';
        case 'contextCompaction':
            return 'Context compacted';
        case 'hookPrompt':
            return extractHookPromptText(item.fragments);
        default:
            return '';
    }
}
function createFallbackItemText(itemType: any) {
    return `[${itemType || 'unknown'}]`;
}
function upsertNormalizedItem(items: any, nextItem: any) {
    const existingIndex = items.findIndex((item: any) => item.id === nextItem.id);
    if (existingIndex === -1) {
        items.push(nextItem);
        return;
    }
    items.splice(existingIndex, 1);
    items.push(nextItem);
}
export function normalizeCodexThreadItem({ threadId, turnId, turnStatus, item, userMessageOrdinalWithinTurn = 0 }: any) {
    if (!item?.id) {
        return null;
    }
    if (item?.type === 'userMessage') {
        return {
            id: turnId
                ? createCanonicalUserMessageId({
                    turnId,
                    ordinalWithinTurn: userMessageOrdinalWithinTurn,
                })
                : item.id,
            kind: 'message',
            itemType: 'userMessage',
            role: 'user',
            text: extractUserMessageText(item.content),
            state: 'complete',
            threadId,
            turnId,
            content: item.content || [],
            raw: item,
        };
    }
    if (item?.type === 'agentMessage') {
        return {
            id: item.id,
            kind: 'message',
            itemType: 'agentMessage',
            role: 'assistant',
            text: item.text || '',
            state: normalizeTimelineItemState({ turnStatus }),
            threadId,
            turnId,
            raw: item,
        };
    }
    if (SPECIAL_ITEM_TYPES.has(item?.type)) {
        const extractedText = extractSpecialItemText(item);
        const text = item.type === 'reasoning' ? extractedText : extractedText || createFallbackItemText(item.type);
        return {
            id: item.id,
            kind: 'special',
            itemType: item.type,
            text,
            state: normalizeTimelineItemState({ turnStatus, itemStatus: item.status }),
            threadId,
            turnId,
            ...(item.status ? { status: item.status } : {}),
            raw: item,
        };
    }
    return {
        id: item.id,
        kind: 'fallback',
        itemType: item?.type || 'unknown',
        text: createFallbackItemText(item?.type || 'unknown'),
        state: normalizeTimelineItemState({ turnStatus, itemStatus: item?.status }),
        threadId,
        turnId,
        raw: item,
    };
}
function createNormalizedTimelineItemsFromTurns(threadId: any, turns: any = []) {
    const timelineItems: any[] = [];
    for (const turn of turns) {
        let userMessageOrdinalWithinTurn = 0;
        for (const item of turn?.items || []) {
            const normalizedItem = normalizeCodexThreadItem({
                threadId,
                turnId: turn?.id || null,
                turnStatus: turn?.status,
                item,
                userMessageOrdinalWithinTurn,
            });
            if (normalizedItem) {
                upsertNormalizedItem(timelineItems, normalizedItem);
            }
            if (item?.type === 'userMessage') {
                userMessageOrdinalWithinTurn += 1;
            }
        }
    }
    return timelineItems;
}
export function normalizeResumeThreadResult(result: any) {
    const thread = result?.thread;
    const turns = thread?.turns || [];
    const latestTurn = turns.at(-1) || null;
    const normalizedLatestTurn = latestTurn
        ? normalizeCodexTurn({
            turn: latestTurn,
            threadId: thread?.id,
            source: 'thread_resume',
        })
        : null;
    return {
        threadId: thread?.id || '',
        latestTurn: normalizedLatestTurn,
        collaborationModeKind: typeof thread?.collaborationModeKind === 'string' && thread.collaborationModeKind ? thread.collaborationModeKind : undefined,
        threadName: typeof thread?.name === 'string' ? thread.name : '',
        threadStatus: thread?.status ?? null,
        threadStatusText: formatThreadStatusText(thread?.status),
        tokenUsageText: '',
        messages: createNormalizedTimelineItemsFromTurns(thread?.id || '', turns),
        notices: [],
        pendingRequests: [],
        lastError: createCodexRuntimeErrorFromTurnError({
            error: latestTurn?.error,
            threadId: thread?.id,
            turnId: latestTurn?.id,
            presentationScope: 'conversation',
            source: 'thread_resume',
        }),
    };
}
export function normalizeThreadHistoryEntry(thread: any) {
    return {
        id: thread?.id || '',
        name: typeof thread?.name === 'string' ? thread.name : '',
        preview: typeof thread?.preview === 'string' ? thread.preview : '',
        workspace: typeof thread?.cwd === 'string' ? thread.cwd : '',
        createdAt: typeof thread?.createdAt === 'number' ? thread.createdAt : 0,
        updatedAt: typeof thread?.updatedAt === 'number' ? thread.updatedAt : 0,
        statusText: formatThreadStatusText(thread?.status),
    };
}
export function normalizeThreadListResult(result: any) {
    const threads = Array.isArray(result?.data) ? result.data : [];
    return threads.map(normalizeThreadHistoryEntry).filter((thread: any) => thread.id);
}
