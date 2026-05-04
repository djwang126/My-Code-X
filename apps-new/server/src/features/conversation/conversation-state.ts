import type { ConversationDomainEvent, ConversationSnapshot } from './conversation-events.js';
import type { ConversationItem, ConversationItemField } from './conversation-events.js';

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

    case 'conversation-item-upserted':
      return upsertConversationItem({
        state,
        item: event.item,
      });
  }
}

interface UpsertConversationItemInput {
  readonly state: ConversationState;
  readonly item: ConversationState['items'][number];
}

function upsertConversationItem(input: UpsertConversationItemInput): ConversationState {
  const existingIndex = input.state.items.findIndex(item => item.id === input.item.id);

  if (existingIndex < 0) {
    return {
      revision: input.state.revision + 1,
      items: [...input.state.items, input.item],
    };
  }

  const existingItem = input.state.items[existingIndex];

  if (existingItem && isSameConversationItem(existingItem, input.item)) {
    return input.state;
  }

  return {
    revision: input.state.revision + 1,
    items: input.state.items.map((item, index) => (index === existingIndex ? input.item : item)),
  };
}

function isSameConversationItem(left: ConversationItem, right: ConversationItem): boolean {
  switch (left.kind) {
    case 'message':
      return right.kind === 'message'
        && left.id === right.id
        && left.role === right.role
        && left.text === right.text;

    case 'work-trace':
      return right.kind === 'work-trace'
        && left.id === right.id
        && left.codexType === right.codexType
        && areSameConversationItemFields(left.fields, right.fields);

    case 'unknown':
      return right.kind === 'unknown'
        && left.id === right.id
        && left.codexType === right.codexType
        && areSameConversationItemFields(left.fields, right.fields);
  }
}

function areSameConversationItemFields(
  left: readonly ConversationItemField[],
  right: readonly ConversationItemField[],
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
