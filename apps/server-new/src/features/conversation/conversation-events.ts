import type { JsonValue } from '../../shared/index.js';

export type ConversationCommand = ReplaceConversationCommand | UpsertConversationItemCommand;

export interface ReplaceConversationCommand {
  readonly kind: 'replace-conversation';
  readonly items: readonly ConversationItem[];
}

export interface UpsertConversationItemCommand {
  readonly kind: 'upsert-conversation-item';
  readonly item: ConversationItem;
}

export type ConversationDomainEvent = ConversationReplacedEvent | ConversationItemUpsertedEvent;

export interface ConversationReplacedEvent {
  readonly kind: 'conversation-replaced';
  readonly items: readonly ConversationItem[];
}

export interface ConversationItemUpsertedEvent {
  readonly kind: 'conversation-item-upserted';
  readonly item: ConversationItem;
}

export interface ConversationSnapshot {
  readonly items: readonly ConversationItem[];
}

export type ConversationItemKind =
  | 'message'
  | 'reasoning'
  | 'plan'
  | 'command'
  | 'file-change'
  | 'tool-call'
  | 'review'
  | 'notice'
  | 'error';

export type ConversationItemLifecycle = 'queued' | 'running' | 'waiting' | 'complete' | 'failed' | 'cancelled';

export interface ConversationItem {
  readonly id: string;
  readonly kind: ConversationItemKind;
  readonly lifecycle: ConversationItemLifecycle;
  readonly text: string;
  readonly role: 'user' | 'assistant' | 'system' | null;
  readonly title: string | null;
  readonly detailId: string | null;
  readonly detailRevision: string | null;
  readonly data: JsonValue;
}
