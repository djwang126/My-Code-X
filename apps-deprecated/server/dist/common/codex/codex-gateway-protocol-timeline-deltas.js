const TIMELINE_DELTA_METHODS = {
    'item/plan/delta': {
        itemType: 'plan',
    },
    'item/reasoning/summaryTextDelta': {
        itemType: 'reasoning',
        deltaField: 'summary',
        indexField: 'summaryIndex',
    },
    'item/reasoning/textDelta': {
        itemType: 'reasoning',
        deltaField: 'content',
        indexField: 'contentIndex',
    },
    'item/commandExecution/outputDelta': {
        itemType: 'commandExecution',
        deltaField: 'aggregatedOutput',
    },
    'item/fileChange/outputDelta': {
        itemType: 'fileChange',
        deltaField: 'output',
    },
    'item/mcpToolCall/progress': {
        itemType: 'mcpToolCall',
        deltaField: 'progress',
        valueField: 'progress',
    },
    'item/commandExecution/terminalInteraction': {
        itemType: 'commandExecution',
        deltaField: 'terminalInteraction',
        valueField: 'interaction',
    },
};
export function mapTimelineDeltaEvent(method, params = {}) {
    const deltaMapping = TIMELINE_DELTA_METHODS[method];
    if (deltaMapping && params?.itemId) {
        const event = {
            type: 'timeline_item_delta',
            threadId: params.threadId,
            turnId: params.turnId,
            itemId: params.itemId,
            itemType: deltaMapping.itemType,
        };
        if (typeof params.delta === 'string') {
            event.delta = params.delta;
        }
        if (deltaMapping.deltaField) {
            event.deltaField = deltaMapping.deltaField;
        }
        if (deltaMapping.indexField && typeof params[deltaMapping.indexField] === 'number') {
            event.index = params[deltaMapping.indexField];
        }
        if (deltaMapping.valueField && params[deltaMapping.valueField] !== undefined) {
            event.value = params[deltaMapping.valueField];
        }
        return event;
    }
    if (method === 'item/reasoning/summaryPartAdded' && params?.itemId) {
        return {
            type: 'timeline_item_delta',
            threadId: params.threadId,
            turnId: params.turnId,
            itemId: params.itemId,
            itemType: 'reasoning',
            deltaField: 'summary_boundary',
            index: typeof params.summaryIndex === 'number' ? params.summaryIndex : undefined,
        };
    }
    return null;
}
//# sourceMappingURL=codex-gateway-protocol-timeline-deltas.js.map