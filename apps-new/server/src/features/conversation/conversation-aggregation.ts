import type { ConversationMessageItem } from './conversation-events.js';
import type { ConversationScheduledTask, ConversationSchedulerPort } from './conversation-ports.js';

export interface ConversationAggregation {
  recordDelta(input: RecordConversationDeltaInput): void;
  discardItem(input: DiscardPendingConversationItemInput): void;
  discardThread(input: DiscardPendingConversationThreadInput): void;
  flushTurn(input: FlushPendingConversationTurnInput): void;
}

export interface CreateConversationAggregationInput {
  readonly delayMs: number;
  readonly scheduler: ConversationSchedulerPort;
  flush(input: FlushPendingConversationItemInput): void;
}

export interface RecordConversationDeltaInput {
  readonly threadId: string;
  readonly turnId: string;
  readonly itemId: string;
  readonly currentText: string;
  readonly deltaText: string;
}

export interface DiscardPendingConversationItemInput {
  readonly threadId: string;
  readonly itemId: string;
}

export interface DiscardPendingConversationThreadInput {
  readonly threadId: string;
}

export interface FlushPendingConversationItemInput {
  readonly threadId: string;
  readonly item: ConversationMessageItem;
}

export interface FlushPendingConversationTurnInput {
  readonly threadId: string;
  readonly turnId: string;
}

interface PendingConversationItem {
  readonly threadId: string;
  readonly turnId: string;
  readonly item: ConversationMessageItem;
  readonly task: ConversationScheduledTask;
}

export function createConversationAggregation(input: CreateConversationAggregationInput): ConversationAggregation {
  const pendingItems = new Map<string, PendingConversationItem>();

  function flushItem(threadId: string, itemId: string): void {
    const key = createPendingItemKey({ threadId, itemId });
    const pending = pendingItems.get(key);

    if (!pending) {
      return;
    }

    pending.task.cancel();
    pendingItems.delete(key);
    input.flush({
      threadId,
      item: pending.item,
    });
  }

  return {
    recordDelta(delta: RecordConversationDeltaInput): void {
      const key = createPendingItemKey({
        threadId: delta.threadId,
        itemId: delta.itemId,
      });
      const pending = pendingItems.get(key);
      const item = createAssistantMessageFromDelta({
        itemId: delta.itemId,
        text: `${pending?.item.text ?? delta.currentText}${delta.deltaText}`,
      });

      if (pending) {
        pendingItems.set(key, {
          ...pending,
          item,
        });
        return;
      }

      const task = input.scheduler.schedule({
        delayMs: input.delayMs,
        run() {
          flushItem(delta.threadId, delta.itemId);
        },
      });

      pendingItems.set(key, {
        threadId: delta.threadId,
        turnId: delta.turnId,
        item,
        task,
      });
    },

    discardItem(item: DiscardPendingConversationItemInput): void {
      const key = createPendingItemKey(item);
      const pending = pendingItems.get(key);

      if (!pending) {
        return;
      }

      pending.task.cancel();
      pendingItems.delete(key);
    },

    discardThread(thread: DiscardPendingConversationThreadInput): void {
      for (const [key, pending] of pendingItems) {
        if (pending.threadId !== thread.threadId) {
          continue;
        }

        pending.task.cancel();
        pendingItems.delete(key);
      }
    },

    flushTurn(turn: FlushPendingConversationTurnInput): void {
      const itemIds = [...pendingItems.values()]
        .filter(pending => pending.threadId === turn.threadId && pending.turnId === turn.turnId)
        .map(pending => pending.item.id);

      for (const itemId of itemIds) {
        flushItem(turn.threadId, itemId);
      }
    },
  };
}

interface CreatePendingItemKeyInput {
  readonly threadId: string;
  readonly itemId: string;
}

function createPendingItemKey(input: CreatePendingItemKeyInput): string {
  return `${input.threadId}\u0000${input.itemId}`;
}

interface CreateAssistantMessageFromDeltaInput {
  readonly itemId: string;
  readonly text: string;
}

function createAssistantMessageFromDelta(input: CreateAssistantMessageFromDeltaInput): ConversationMessageItem {
  return {
    id: input.itemId,
    kind: 'message',
    role: 'assistant',
    text: input.text,
  };
}
