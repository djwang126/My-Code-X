function normalizeHashInput(value: any) {
    const normalizedText = JSON.stringify(value) ?? 'null';
    let hash = 2166136261;
    for (let index = 0; index < normalizedText.length; index += 1) {
        hash ^= normalizedText.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return `${normalizedText.length}:${(hash >>> 0).toString(16)}`;
}
function cloneRawItem(raw: any) {
    if (!raw || typeof raw !== 'object') {
        return raw;
    }
    const nextRaw = { ...raw };
    if (Array.isArray(raw.changes)) {
        nextRaw.changes = raw.changes.map((change: any) => (change && typeof change === 'object' ? { ...change } : change));
    }
    if (Array.isArray(raw.content)) {
        nextRaw.content = raw.content.map((entry: any) => (entry && typeof entry === 'object' ? { ...entry } : entry));
    }
    if (Array.isArray(raw.fragments)) {
        nextRaw.fragments = raw.fragments.map((fragment: any) => (fragment && typeof fragment === 'object' ? { ...fragment } : fragment));
    }
    return nextRaw;
}
function cloneTimelineDetail(detail: any) {
    if (!detail || typeof detail !== 'object') {
        return {};
    }
    return cloneRawItem(detail);
}
function createTimelineItemDetailPayload(item: any) {
    if (item?.kind !== 'special') {
        return null;
    }
    const raw = item.raw ?? {};
    if (item.itemType === 'commandExecution') {
        return {
            itemId: item.id,
            itemType: item.itemType,
            detailRevision: normalizeHashInput({
                command: raw.command ?? null,
                cwd: raw.cwd ?? null,
                aggregatedOutput: raw.aggregatedOutput ?? null,
                exitCode: raw.exitCode ?? null,
                durationMs: raw.durationMs ?? null,
            }),
            raw: cloneTimelineDetail({
                type: 'commandExecution',
                id: item.id,
                command: raw.command ?? null,
                cwd: raw.cwd ?? null,
                aggregatedOutput: raw.aggregatedOutput ?? null,
                exitCode: raw.exitCode ?? null,
                durationMs: raw.durationMs ?? null,
            }),
        };
    }
    if (item.itemType === 'fileChange') {
        return {
            itemId: item.id,
            itemType: item.itemType,
            detailRevision: normalizeHashInput({
                changes: Array.isArray(raw.changes) ? raw.changes : [],
                output: raw.output ?? null,
            }),
            raw: cloneTimelineDetail({
                type: 'fileChange',
                id: item.id,
                changes: Array.isArray(raw.changes) ? raw.changes : [],
                output: raw.output ?? null,
            }),
        };
    }
    return null;
}
function createTitleOnlyLargeItem(item: any) {
    const detailPayload = createTimelineItemDetailPayload(item);
    if (!detailPayload) {
        return null;
    }
    return {
        ...item,
        text: '',
        raw: {
            type: item.itemType,
            id: item.id,
            detailRevision: detailPayload.detailRevision,
            detailAvailable: true,
        },
    };
}
export function serializeTimelineItemForPublic(item: any) {
    const titleOnlyLargeItem = createTitleOnlyLargeItem(item);
    if (titleOnlyLargeItem) {
        return titleOnlyLargeItem;
    }
    const nextItem = {
        ...item,
        raw: cloneRawItem(item?.raw),
    };
    if (Array.isArray(item?.content)) {
        nextItem.content = item.content.map((entry: any) => (entry && typeof entry === 'object' ? { ...entry } : entry));
    }
    return nextItem;
}
export function serializeTimelineItemsForPublic(items: any = []) {
    return items.map((item: any) => serializeTimelineItemForPublic(item));
}
export function serializeTimelineItemsForBootstrap(items: any = []) {
    return serializeTimelineItemsForPublic(items);
}
export function readTimelineItemContentPayload(item: any) {
    return createTimelineItemDetailPayload(item);
}
