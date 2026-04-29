import type { ClientConversationItem } from '../contracts/index.js';
import type { ConversationItem, ConversationSnapshot } from '../features/conversation/index.js';

export interface PresentConversationInput {
  readonly snapshot: ConversationSnapshot;
}

export function presentConversation(input: PresentConversationInput): readonly ClientConversationItem[] {
  return input.snapshot.items.map(item => presentConversationItem({ item }));
}

export interface PresentConversationItemInput {
  readonly item: ConversationItem;
}

export function presentConversationItem(input: PresentConversationItemInput): ClientConversationItem {
  return {
    id: input.item.id,
    text: input.item.text,
  };
}
