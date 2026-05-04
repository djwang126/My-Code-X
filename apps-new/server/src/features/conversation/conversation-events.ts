import type {
  JsonValue,
  RuntimeItemDeltaKind,
  RuntimeTimelineItem,
  RuntimeThreadItem,
} from '../../ports/index.js';

export type ConversationCommand =
  | ReplaceConversationCommand
  | ReplaceRuntimeConversationCommand
  | RecordRuntimeThreadItemCommand
  | RecordRuntimeItemDeltaCommand;

export interface ConversationThreadCommandBase {
  readonly threadId: string;
}

export interface ReplaceConversationCommand extends ConversationThreadCommandBase {
  readonly kind: 'replace-conversation';
  readonly items: readonly ConversationItem[];
}

export interface ReplaceRuntimeConversationCommand extends ConversationThreadCommandBase {
  readonly kind: 'replace-runtime-conversation';
  readonly items: readonly RuntimeTimelineItem[];
}

export interface RecordRuntimeThreadItemCommand extends ConversationThreadCommandBase {
  readonly kind: 'record-runtime-thread-item';
  readonly item: RuntimeThreadItem;
}

export interface RecordRuntimeItemDeltaCommand extends ConversationThreadCommandBase {
  readonly kind: 'record-runtime-item-delta';
  readonly itemId: string;
  readonly deltaKind: RuntimeItemDeltaKind;
  readonly text: string | null;
}

export type ConversationDomainEvent =
  | ConversationReplacedEvent
  | ConversationItemUpsertedEvent;

export interface ConversationDomainEventBase {
  readonly threadId: string;
  readonly revision: number;
}

export interface ConversationReplacedEvent extends ConversationDomainEventBase {
  readonly kind: 'conversation-replaced';
  readonly items: readonly ConversationItem[];
}

export interface ConversationItemUpsertedEvent extends ConversationDomainEventBase {
  readonly kind: 'conversation-item-upserted';
  readonly item: ConversationItem;
}

export interface ConversationSnapshot {
  readonly revision: number;
  readonly items: readonly ConversationItem[];
}

export type ConversationItem =
  | ConversationMessageItem
  | ConversationWorkTraceItem
  | ConversationUnknownItem;

export interface ConversationMessageItem {
  readonly id: string;
  readonly kind: 'message';
  readonly role: ConversationMessageRole;
  readonly text: string;
}

export type ConversationMessageRole = 'user' | 'assistant';

export interface ConversationItemField {
  readonly name: string;
  readonly value: JsonValue;
}

export interface ConversationWorkTraceItem {
  readonly id: string;
  readonly kind: 'work-trace';
  readonly codexType: string;
  readonly fields: readonly ConversationItemField[];
}

export interface ConversationUnknownItem {
  readonly id: string;
  readonly kind: 'unknown';
  readonly codexType: string;
  readonly fields: readonly ConversationItemField[];
}

export function isConversationDomainEvent(event: unknown): event is ConversationDomainEvent {
  if (!isRecord(event)) {
    return false;
  }

  if (typeof event.threadId !== 'string' || typeof event.revision !== 'number') {
    return false;
  }

  switch (event.kind) {
    case 'conversation-replaced':
      return Array.isArray(event.items);

    case 'conversation-item-upserted':
      return isRecord(event.item);

    default:
      return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
