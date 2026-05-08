import { cloneCodexRuntimeError } from '../../../common/codex/codex-runtime-error.js';
import { cloneSessionThreadStatus, parseSessionTurnExecution, serializeSessionTurnExecution, } from '@my-code-x/contracts';
import { createCanonicalUserMessageId, reconcileCanonicalUserMessageTimelineItem, } from '@my-code-x/contracts';
export function cloneMessage(message) {
    return { ...message };
}
export function cloneNotice(notice) {
    return { ...notice };
}
export function clonePendingRequest(request) {
    return {
        ...request,
        raw: request.raw ? { ...request.raw } : request.raw,
    };
}
export function cloneThreadStatus(threadStatus) {
    return cloneSessionThreadStatus(threadStatus);
}
export function upsertSessionItem(items, nextItem) {
    const existingIndex = items.findIndex(item => item.id === nextItem.id);
    if (existingIndex === -1) {
        items.push(nextItem);
        return;
    }
    items[existingIndex] = { ...nextItem };
}
export function reconcileOptimisticUserMessage(items, nextItem) {
    return reconcileCanonicalUserMessageTimelineItem({ items, nextItem });
}
export function createSessionSpecialItem({ threadId, turnId, itemId, itemType, text = '', raw = {}, }) {
    return {
        id: itemId,
        kind: 'special',
        itemType,
        text,
        state: 'streaming',
        threadId,
        turnId,
        raw: {
            type: itemType,
            id: itemId,
            ...raw,
        },
    };
}
export function appendIndexedText(entries, index, delta) {
    const nextEntries = Array.isArray(entries) ? [...entries] : [];
    const safePosition = typeof index === 'number' && Number.isInteger(index) && index >= 0 ? index : 0;
    const existingValue = nextEntries[safePosition];
    const existingText = typeof existingValue === 'string' ? existingValue : typeof existingValue?.text === 'string' ? existingValue.text : '';
    nextEntries[safePosition] = {
        text: `${existingText}${delta}`,
    };
    return nextEntries;
}
export function extractReasoningText(raw = {}) {
    if (Array.isArray(raw.summary) && raw.summary.length) {
        return raw.summary
            .map((entry) => (typeof entry?.text === 'string' ? entry.text : typeof entry === 'string' ? entry : ''))
            .filter(Boolean)
            .join('\n');
    }
    if (Array.isArray(raw.content) && raw.content.length) {
        return raw.content
            .map((entry) => (typeof entry?.text === 'string' ? entry.text : typeof entry === 'string' ? entry : ''))
            .filter(Boolean)
            .join('\n');
    }
    return '';
}
function cloneTurnExecution(turnExecution) {
    return serializeSessionTurnExecution(turnExecution, {
        fieldName: 'cloned session turn execution',
    });
}
export function cloneSessionState(state) {
    return {
        slotId: state.slotId,
        viewerId: state.viewerId,
        workspace: state.workspace,
        threadId: state.threadId,
        turnExecution: cloneTurnExecution(state.turnExecution),
        ...(state.collaborationModeKind ? { collaborationModeKind: state.collaborationModeKind } : {}),
        ...(state.appliedThreadRuntimeOverrides
            ? {
                appliedThreadRuntimeOverrides: { ...state.appliedThreadRuntimeOverrides },
            }
            : {}),
        threadName: state.threadName,
        threadStatus: cloneThreadStatus(state.threadStatus),
        threadStatusText: state.threadStatusText,
        tokenUsageText: state.tokenUsageText,
        messages: state.messages.map(cloneMessage),
        notices: state.notices.map(cloneNotice),
        pendingRequests: state.pendingRequests.map(clonePendingRequest),
        lastError: cloneCodexRuntimeError(state.lastError),
        lastUpdatedAt: state.lastUpdatedAt,
    };
}
export function createSessionState({ viewerId, slotId, workspace = '', threadId = '', turnExecution, collaborationModeKind = undefined, appliedThreadRuntimeOverrides = undefined, threadName = '', threadStatus = null, threadStatusText = '', tokenUsageText = '', messages = [], notices = [], pendingRequests = [], lastError = null, gatewayGeneration = undefined, now, }) {
    const parsedTurnExecution = parseSessionTurnExecution(turnExecution, {
        fieldName: 'createSessionState.turnExecution',
    });
    return {
        slotId,
        viewerId,
        workspace,
        threadId,
        turnExecution: parsedTurnExecution,
        ...(collaborationModeKind ? { collaborationModeKind } : {}),
        ...(appliedThreadRuntimeOverrides
            ? { appliedThreadRuntimeOverrides: { ...appliedThreadRuntimeOverrides } }
            : {}),
        threadName,
        threadStatus: cloneThreadStatus(threadStatus),
        threadStatusText,
        tokenUsageText,
        messages: messages.map(cloneMessage),
        notices: notices.map(cloneNotice),
        pendingRequests: pendingRequests.map(clonePendingRequest),
        lastError: cloneCodexRuntimeError(lastError),
        ...(Number.isInteger(gatewayGeneration) ? { gatewayGeneration } : {}),
        lastUpdatedAt: now(),
    };
}
export function upsertSessionNotice(notices, nextNotice) {
    const existingIndex = notices.findIndex(notice => notice.id === nextNotice.id);
    if (existingIndex === -1) {
        notices.push(nextNotice);
        return;
    }
    notices[existingIndex] = { ...nextNotice };
}
export function upsertPendingRequest(pendingRequests, nextRequest) {
    const existingIndex = pendingRequests.findIndex(request => request.id === nextRequest.id);
    if (existingIndex === -1) {
        pendingRequests.push(clonePendingRequest(nextRequest));
        return;
    }
    pendingRequests[existingIndex] = clonePendingRequest(nextRequest);
}
export function removePendingRequest(pendingRequests, requestId) {
    const existingIndex = pendingRequests.findIndex(request => request.id === requestId);
    if (existingIndex === -1) {
        return null;
    }
    const [removedRequest] = pendingRequests.splice(existingIndex, 1);
    return removedRequest;
}
export function createUserMessage({ threadId, turnId, text, content, }) {
    const nextContent = Array.isArray(content) && content.length ? content : [{ type: 'text', text }];
    const messageId = createCanonicalUserMessageId({ turnId });
    return {
        id: messageId,
        kind: 'message',
        itemType: 'userMessage',
        role: 'user',
        text,
        state: 'complete',
        threadId,
        turnId,
        content: nextContent,
        raw: {
            type: 'userMessage',
            id: messageId,
            content: nextContent,
        },
    };
}
export function assertSessionContextMatches(runtime, { workspace = '', threadId = '' }) {
    if (runtime?.workspace && workspace && runtime.workspace !== workspace) {
        throw new Error('workspace mismatch for slot session');
    }
    if (runtime?.threadId && threadId && runtime.threadId !== threadId) {
        throw new Error('thread mismatch for slot session');
    }
}
export function resolveSessionWorkspace(runtime, workspace = '') {
    return workspace || runtime?.workspace || '';
}
//# sourceMappingURL=chat-session-state.js.map