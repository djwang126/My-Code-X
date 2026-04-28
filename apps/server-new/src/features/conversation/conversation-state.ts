import type { ConversationDomainEvent, ConversationSnapshot } from './conversation-events.js';

export type ConversationState = ConversationSnapshot;

export function createInitialConversationState(): ConversationState {
  return {
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
      return {
        items: event.items,
      };

    case 'conversation-item-upserted':
      return {
        items: upsertConversationItem(state.items, event.item),
      };
  }
}

function upsertConversationItem<TItem extends { readonly id: string }>(items: readonly TItem[], nextItem: TItem): readonly TItem[] {
  const index = items.findIndex(item => item.id === nextItem.id);

  if (index === -1) {
    return [...items, nextItem];
  }

  return items.map((item, itemIndex) => (itemIndex === index ? nextItem : item));
}
