import type { RuntimeThreadItem } from '../../ports/index.js';

export type ConversationCommand =
  | ReplaceConversationCommand
  | AppendConversationItemCommand
  | RecordRuntimeThreadItemCommand;

export interface ReplaceConversationCommand {
  readonly kind: 'replace-conversation';
  readonly items: readonly ConversationItem[];
}

export interface AppendConversationItemCommand {
  readonly kind: 'append-conversation-item';
  readonly item: ConversationItem;
}

export interface RecordRuntimeThreadItemCommand {
  readonly kind: 'record-runtime-thread-item';
  readonly item: RuntimeThreadItem;
}

export type ConversationDomainEvent =
  | ConversationReplacedEvent
  | ConversationItemAppendedEvent
  | ConversationItemUpsertedEvent;

export interface ConversationReplacedEvent {
  readonly kind: 'conversation-replaced';
  readonly items: readonly ConversationItem[];
}

export interface ConversationItemAppendedEvent {
  readonly kind: 'conversation-item-appended';
  readonly item: ConversationItem;
}

export interface ConversationItemUpsertedEvent {
  readonly kind: 'conversation-item-upserted';
  readonly item: ConversationItem;
}

export interface ConversationSnapshot {
  readonly revision: number;
  readonly items: readonly ConversationItem[];
}

export type ConversationItem = ConversationMessageItem;

export interface ConversationMessageItem {
  readonly id: string;
  readonly kind: 'message';
  readonly role: ConversationMessageRole;
  readonly text: string;
}

export type ConversationMessageRole = 'user' | 'assistant';
