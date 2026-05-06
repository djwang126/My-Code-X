import type { ConversationDomainEvent, ConversationSnapshot } from './conversation-events.js';
import type { ConversationItem, ConversationTimelinePosition } from './conversation-events.js';
import { areSameConversationItems } from './conversation-item-equality.js';

export type ConversationState = ConversationSnapshot;

export class ConversationTimelinePositionError extends Error {
  constructor(
    public readonly itemId: string,
    public readonly position: ConversationTimelinePosition,
  ) {
    super(`Conversation timeline position target is missing for item ${itemId}`);
    this.name = 'ConversationTimelinePositionError';
  }
}

export function createInitialConversationState(): ConversationState {
  return {
    status: 'ready',
    revision: 0,
    items: [],
  };
}

export interface ApplyConversationDomainEventInput {
  readonly state: ConversationState;
  readonly event: ConversationDomainEvent;
}

export function applyConversationDomainEvent(input: ApplyConversationDomainEventInput): ConversationState {
  const { state, event } = input;

  switch (event.kind) {
    case 'conversation-replaced':
      return event.conversation;

    case 'conversation-item-upserted':
      return upsertConversationItem({
        state,
        item: event.item,
        position: event.position,
      });
  }
}

interface UpsertConversationItemInput {
  readonly state: ConversationState;
  readonly item: ConversationItem;
  readonly position: ConversationTimelinePosition;
}

function upsertConversationItem(input: UpsertConversationItemInput): ConversationState {
  if (input.state.status !== 'ready') {
    return input.state;
  }

  const existingIndex = input.state.items.findIndex(item => item.id === input.item.id);

  if (existingIndex >= 0) {
    return updateExistingConversationItem({
      state: input.state,
      item: input.item,
      existingIndex,
    });
  }

  const items = insertConversationItem({
    items: input.state.items,
    item: input.item,
    position: input.position,
  });

  if (items === input.state.items) {
    return input.state;
  }

  return {
    status: 'ready',
    revision: input.state.revision + 1,
    items,
  };
}

interface UpdateExistingConversationItemInput {
  readonly state: Extract<ConversationState, { readonly status: 'ready' }>;
  readonly item: ConversationItem;
  readonly existingIndex: number;
}

function updateExistingConversationItem(input: UpdateExistingConversationItemInput): ConversationState {
  const existingItem = input.state.items[input.existingIndex];

  if (existingItem && areSameConversationItems(existingItem, input.item)) {
    return input.state;
  }

  return {
    status: 'ready',
    revision: input.state.revision + 1,
    items: input.state.items.map((item, index) => (index === input.existingIndex ? input.item : item)),
  };
}

interface InsertConversationItemInput {
  readonly items: readonly ConversationItem[];
  readonly item: ConversationItem;
  readonly position: ConversationTimelinePosition;
}

function insertConversationItem(input: InsertConversationItemInput): readonly ConversationItem[] {
  switch (input.position.kind) {
    case 'append':
      return [...input.items, input.item];

    case 'before-item': {
      const position = input.position;
      const targetIndex = input.items.findIndex(item => item.id === position.itemId);

      if (targetIndex < 0) {
        throw new ConversationTimelinePositionError(input.item.id, input.position);
      }

      return [
        ...input.items.slice(0, targetIndex),
        input.item,
        ...input.items.slice(targetIndex),
      ];
    }

    case 'after-item': {
      const position = input.position;
      const targetIndex = input.items.findIndex(item => item.id === position.itemId);

      if (targetIndex < 0) {
        throw new ConversationTimelinePositionError(input.item.id, input.position);
      }

      return [
        ...input.items.slice(0, targetIndex + 1),
        input.item,
        ...input.items.slice(targetIndex + 1),
      ];
    }
  }
}
