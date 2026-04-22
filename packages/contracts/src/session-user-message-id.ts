function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface CreateCanonicalUserMessageIdInput {
  turnId: string;
  ordinalWithinTurn?: number;
}

export interface CanonicalUserMessageIdTurnInput {
  itemId: string;
  turnId: string;
}

export interface CanonicalTimelineItemRawValue {
  type?: string;
  id?: string;
  [key: string]: unknown;
}

export interface CanonicalTimelineItemLike {
  id: string;
  kind?: string | null;
  itemType?: string | null;
  turnId?: string | null;
  raw?: CanonicalTimelineItemRawValue;
}

export interface ReconcileCanonicalUserMessageTimelineItemInput<T extends CanonicalTimelineItemLike> {
  items: T[];
  nextItem: T;
}

export function createCanonicalUserMessageId({
  turnId,
  ordinalWithinTurn = 0,
}: CreateCanonicalUserMessageIdInput): string {
  if (!turnId) {
    return '';
  }

  if (ordinalWithinTurn <= 0) {
    return `user:${turnId}`;
  }

  return `user:${turnId}:u${ordinalWithinTurn + 1}`;
}

export function isCanonicalUserMessageIdForTurn({ itemId, turnId }: CanonicalUserMessageIdTurnInput): boolean {
  if (!itemId || !turnId) {
    return false;
  }

  const firstCanonicalId = createCanonicalUserMessageId({ turnId });

  if (itemId === firstCanonicalId) {
    return true;
  }

  return new RegExp(`^${escapeRegExp(firstCanonicalId)}:u\\d+$`).test(itemId);
}

function isUserMessageTimelineItem(item: CanonicalTimelineItemLike): item is CanonicalTimelineItemLike & { turnId: string } {
  return item.kind === 'message' && item.itemType === 'userMessage' && typeof item.turnId === 'string' && !!item.turnId;
}

function readRawUserMessageId(item: CanonicalTimelineItemLike): string {
  if (item.raw?.type === 'userMessage' && typeof item.raw.id === 'string' && item.raw.id) {
    return item.raw.id;
  }

  return item.id;
}

export function reconcileCanonicalUserMessageTimelineItem<T extends CanonicalTimelineItemLike>({
  items,
  nextItem,
}: ReconcileCanonicalUserMessageTimelineItemInput<T>): T {
  if (!isUserMessageTimelineItem(nextItem)) {
    return nextItem;
  }

  const sameTurnUserItems = items.filter(item => isUserMessageTimelineItem(item) && item.turnId === nextItem.turnId);
  const matchingItemByCanonicalId = sameTurnUserItems.find(item => item.id === nextItem.id);

  if (matchingItemByCanonicalId) {
    return nextItem;
  }

  const matchingItemByRawId = sameTurnUserItems.find(item => readRawUserMessageId(item) === readRawUserMessageId(nextItem));

  if (matchingItemByRawId) {
    return matchingItemByRawId.id === nextItem.id ? nextItem : { ...nextItem, id: matchingItemByRawId.id };
  }

  const optimisticId = createCanonicalUserMessageId({ turnId: nextItem.turnId });
  const optimisticItem = sameTurnUserItems.find(item => item.id === optimisticId);

  if (
    sameTurnUserItems.length === 1 &&
    optimisticItem &&
    readRawUserMessageId(optimisticItem) === optimisticId &&
    !isCanonicalUserMessageIdForTurn({ itemId: nextItem.id, turnId: nextItem.turnId })
  ) {
    return nextItem.id === optimisticId ? nextItem : { ...nextItem, id: optimisticId };
  }

  const canonicalId = createCanonicalUserMessageId({
    turnId: nextItem.turnId,
    ordinalWithinTurn: sameTurnUserItems.length,
  });

  return nextItem.id === canonicalId ? nextItem : { ...nextItem, id: canonicalId };
}
