import type { ConversationDomainEvent, ConversationSnapshot } from './conversation-events.js';

export type ConversationState = ConversationSnapshot;

export function createInitialConversationState(): ConversationState {
  return {
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
      return {
        revision: state.revision + 1,
        items: event.items,
      };

    case 'conversation-item-appended':
      return {
        revision: state.revision + 1,
        items: [...state.items, event.item],
      };
  }
}
