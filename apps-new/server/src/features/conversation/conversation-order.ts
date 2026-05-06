import type { ConversationItem, ConversationTimelinePosition } from './conversation-events.js';

export interface ConversationOrderRegistry {
  replaceThread(input: ReplaceConversationOrderInput): void;
  recordItem(input: RecordConversationOrderItemInput): void;
  locateItem(input: LocateConversationItemPositionInput): ConversationTimelinePosition;
  discardThread(input: DiscardConversationOrderThreadInput): void;
}

export interface ReplaceConversationOrderInput {
  readonly threadId: string;
  readonly itemIds: readonly string[];
}

export interface RecordConversationOrderItemInput {
  readonly threadId: string;
  readonly itemId: string;
}

export interface LocateConversationItemPositionInput {
  readonly threadId: string;
  readonly itemId: string;
  readonly currentItems: readonly ConversationItem[];
}

export interface DiscardConversationOrderThreadInput {
  readonly threadId: string;
}

export function createConversationOrderRegistry(): ConversationOrderRegistry {
  const threadOrders = new Map<string, readonly string[]>();

  return {
    replaceThread(input: ReplaceConversationOrderInput): void {
      threadOrders.set(input.threadId, uniqueItemIds(input.itemIds));
    },

    recordItem(input: RecordConversationOrderItemInput): void {
      const current = threadOrders.get(input.threadId) ?? [];

      if (current.includes(input.itemId)) {
        return;
      }

      threadOrders.set(input.threadId, [...current, input.itemId]);
    },

    locateItem(input: LocateConversationItemPositionInput): ConversationTimelinePosition {
      const existingItem = input.currentItems.find(item => item.id === input.itemId);

      if (existingItem) {
        return { kind: 'append' };
      }

      const order = threadOrders.get(input.threadId) ?? [];
      const itemIndex = order.indexOf(input.itemId);

      if (itemIndex < 0) {
        return { kind: 'append' };
      }

      const currentItemIds = new Set(input.currentItems.map(item => item.id));
      const followingItemId = order.slice(itemIndex + 1).find(itemId => currentItemIds.has(itemId));

      if (followingItemId) {
        return {
          kind: 'before-item',
          itemId: followingItemId,
        };
      }

      const precedingItemId = [...order.slice(0, itemIndex)].reverse().find(itemId => currentItemIds.has(itemId));

      if (precedingItemId) {
        return {
          kind: 'after-item',
          itemId: precedingItemId,
        };
      }

      return { kind: 'append' };
    },

    discardThread(input: DiscardConversationOrderThreadInput): void {
      threadOrders.delete(input.threadId);
    },
  };
}

function uniqueItemIds(itemIds: readonly string[]): readonly string[] {
  const output: string[] = [];
  const seen = new Set<string>();

  for (const itemId of itemIds) {
    if (seen.has(itemId)) {
      continue;
    }

    seen.add(itemId);
    output.push(itemId);
  }

  return output;
}
