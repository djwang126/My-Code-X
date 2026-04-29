export type ConversationCommand = ReplaceConversationCommand | AppendConversationItemCommand;

export interface ReplaceConversationCommand {
  readonly kind: 'replace-conversation';
  readonly items: readonly ConversationItem[];
}

export interface AppendConversationItemCommand {
  readonly kind: 'append-conversation-item';
  readonly item: ConversationItem;
}

export type ConversationDomainEvent = ConversationReplacedEvent | ConversationItemAppendedEvent;

export interface ConversationReplacedEvent {
  readonly kind: 'conversation-replaced';
  readonly items: readonly ConversationItem[];
}

export interface ConversationItemAppendedEvent {
  readonly kind: 'conversation-item-appended';
  readonly item: ConversationItem;
}

export interface ConversationSnapshot {
  readonly revision: number;
  readonly items: readonly ConversationItem[];
}

export interface ConversationItem {
  readonly id: string;
  readonly text: string;
}
