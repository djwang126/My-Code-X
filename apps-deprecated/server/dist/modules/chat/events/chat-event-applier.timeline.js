import { appendIndexedText, createSessionSpecialItem, extractReasoningText, } from '../shared/chat-session-state.js';
export function getAssistantMessage(runtime, itemId) {
    const existing = runtime.messages.find(message => message.id === itemId);
    if (existing) {
        return existing;
    }
    const message = {
        id: itemId,
        kind: 'message',
        itemType: 'agentMessage',
        role: 'assistant',
        text: '',
        state: 'streaming',
        threadId: runtime.threadId,
        turnId: runtime.turnExecution.activeTurnId,
        raw: {
            type: 'agentMessage',
            id: itemId,
            text: '',
        },
    };
    runtime.messages.push(message);
    return message;
}
function ensureSpecialRuntimeItem(runtime, { itemId, itemType, turnId }) {
    const existing = runtime.messages.find(message => message.id === itemId);
    if (existing) {
        return existing;
    }
    const item = createSessionSpecialItem({
        threadId: runtime.threadId,
        turnId: turnId ?? runtime.turnExecution.activeTurnId,
        itemId,
        itemType,
    });
    runtime.messages.push(item);
    return item;
}
export function applyTimelineItemDelta(runtime, event) {
    const item = ensureSpecialRuntimeItem(runtime, {
        itemId: event.itemId,
        itemType: event.itemType,
        turnId: event.turnId,
    });
    item.turnId = event.turnId ?? item.turnId;
    item.threadId = runtime.threadId;
    item.state = 'streaming';
    item.raw = {
        type: event.itemType,
        id: event.itemId,
        ...(item.raw || {}),
    };
    if (event.itemType === 'plan') {
        const nextText = `${typeof item.raw.text === 'string' ? item.raw.text : ''}${event.delta || ''}`;
        item.raw.text = nextText;
        item.text = nextText;
        return item;
    }
    if (event.itemType === 'reasoning') {
        if (event.deltaField === 'summary') {
            item.raw.summary = appendIndexedText(item.raw.summary, event.index, event.delta || '');
        }
        else if (event.deltaField === 'summary_boundary') {
            item.raw.summary = appendIndexedText(item.raw.summary, event.index, '');
        }
        else if (event.deltaField === 'content') {
            item.raw.content = appendIndexedText(item.raw.content, event.index, event.delta || '');
        }
        item.text = extractReasoningText(item.raw);
        return item;
    }
    if (event.deltaField === 'aggregatedOutput') {
        const nextOutput = `${typeof item.raw.aggregatedOutput === 'string' ? item.raw.aggregatedOutput : ''}${event.delta || ''}`;
        item.raw.aggregatedOutput = nextOutput;
        item.text = item.raw.command || nextOutput;
        return item;
    }
    if (event.deltaField === 'output') {
        const nextOutput = `${typeof item.raw.output === 'string' ? item.raw.output : ''}${event.delta || ''}`;
        item.raw.output = nextOutput;
        item.text = item.text || nextOutput;
        return item;
    }
    if (event.deltaField === 'progress') {
        item.raw.progress = event.value;
        if (!item.text && item.raw.server && item.raw.tool) {
            item.text = `${item.raw.server}.${item.raw.tool}`;
        }
        return item;
    }
    if (event.deltaField === 'terminalInteraction') {
        item.raw.terminalInteraction = event.value;
        item.text = item.text || '[terminal interaction]';
        return item;
    }
    if (typeof event.delta === 'string') {
        item.text = `${item.text || ''}${event.delta}`;
    }
    return item;
}
//# sourceMappingURL=chat-event-applier.timeline.js.map