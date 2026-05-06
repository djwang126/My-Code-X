import type { ConversationItem, ConversationItemField } from './conversation-events.js';

export function areSameConversationItems(left: ConversationItem, right: ConversationItem): boolean {
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

    case 'error':
      return right.kind === 'error'
        && left.id === right.id
        && left.message === right.message;
  }
}

export function areSameConversationItemFields(
  left: readonly ConversationItemField[],
  right: readonly ConversationItemField[],
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
