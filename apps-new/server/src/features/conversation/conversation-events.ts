import type {
  JsonObject,
  JsonValue,
  RuntimeErrorInfo,
  RuntimeItemDeltaKind,
  RuntimeTimelineItem,
  RuntimeThreadItem,
  RuntimeTurn,
} from '../../ports/index.js';

export type ConversationCommand =
  | ReplaceConversationCommand
  | ReplaceRuntimeConversationCommand
  | FailConversationCommand
  | RecordRuntimeThreadItemCommand
  | RecordRuntimeItemDeltaCommand
  | RecordRuntimeTurnPlanCommand
  | RecordRuntimeTurnDiffCommand
  | RecordRuntimeErrorCommand;

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
  readonly turns: readonly RuntimeTurn[] | null;
}

export interface FailConversationCommand extends ConversationThreadCommandBase {
  readonly kind: 'fail-conversation';
  readonly error: ConversationResourceError;
}

export interface RecordRuntimeThreadItemCommand extends ConversationThreadCommandBase {
  readonly kind: 'record-runtime-thread-item';
  readonly item: RuntimeThreadItem;
}

export interface RecordRuntimeItemDeltaCommand extends ConversationThreadCommandBase {
  readonly kind: 'record-runtime-item-delta';
  readonly turnId: string;
  readonly itemId: string;
  readonly deltaKind: RuntimeItemDeltaKind;
  readonly text: string | null;
  readonly data?: JsonObject | null;
}

export interface RecordRuntimeTurnPlanCommand extends ConversationThreadCommandBase {
  readonly kind: 'record-runtime-turn-plan';
  readonly turnId: string;
  readonly explanation: string | null;
  readonly plan: readonly JsonValue[];
}

export interface RecordRuntimeTurnDiffCommand extends ConversationThreadCommandBase {
  readonly kind: 'record-runtime-turn-diff';
  readonly turnId: string;
  readonly diff: string;
}

export interface RecordRuntimeErrorCommand extends ConversationThreadCommandBase {
  readonly kind: 'record-runtime-error';
  readonly turnId: string;
  readonly error: RuntimeErrorInfo;
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
  readonly conversation: ConversationSnapshot;
}

export interface ConversationItemUpsertedEvent extends ConversationDomainEventBase {
  readonly kind: 'conversation-item-upserted';
  readonly item: ConversationItem;
  readonly position: ConversationTimelinePosition;
}

export type ConversationTimelinePosition =
  | ConversationTimelineAppendPosition
  | ConversationTimelineBeforeItemPosition
  | ConversationTimelineAfterItemPosition;

export interface ConversationTimelineAppendPosition {
  readonly kind: 'append';
}

export interface ConversationTimelineBeforeItemPosition {
  readonly kind: 'before-item';
  readonly itemId: string;
}

export interface ConversationTimelineAfterItemPosition {
  readonly kind: 'after-item';
  readonly itemId: string;
}

export type ConversationSnapshot =
  | ConversationReadySnapshot
  | ConversationFailedSnapshot;

export interface ConversationReadySnapshot {
  readonly status: 'ready';
  readonly revision: number;
  readonly items: readonly ConversationItem[];
}

export interface ConversationFailedSnapshot {
  readonly status: 'failed';
  readonly revision: number;
  readonly error: ConversationResourceError;
}

export interface ConversationResourceError {
  readonly message: string;
}

export type ConversationItem =
  | ConversationMessageItem
  | ConversationWorkTraceItem
  | ConversationUnknownItem
  | ConversationErrorItem;

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

export interface ConversationErrorItem {
  readonly id: string;
  readonly kind: 'error';
  readonly message: string;
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
      return isConversationSnapshot(event.conversation, event.revision);

    case 'conversation-item-upserted':
      return isConversationItem(event.item) && isConversationTimelinePosition(event.position);

    default:
      return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isConversationSnapshot(value: unknown, revision: number): value is ConversationSnapshot {
  if (!isRecord(value) || value.revision !== revision) {
    return false;
  }

  switch (value.status) {
    case 'ready':
      return Array.isArray(value.items) && value.items.every(isConversationItem);

    case 'failed':
      return isConversationResourceError(value.error);

    default:
      return false;
  }
}

function isConversationResourceError(value: unknown): value is ConversationResourceError {
  return isRecord(value) && typeof value.message === 'string';
}

function isConversationItem(value: unknown): value is ConversationItem {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return false;
  }

  switch (value.kind) {
    case 'message':
      return (value.role === 'user' || value.role === 'assistant') && typeof value.text === 'string';

    case 'work-trace':
    case 'unknown':
      return typeof value.codexType === 'string' && Array.isArray(value.fields) && value.fields.every(isConversationItemField);

    case 'error':
      return typeof value.message === 'string';

    default:
      return false;
  }
}

function isConversationItemField(value: unknown): value is ConversationItemField {
  return isRecord(value) && typeof value.name === 'string' && 'value' in value;
}

function isConversationTimelinePosition(value: unknown): value is ConversationTimelinePosition {
  if (!isRecord(value)) {
    return false;
  }

  switch (value.kind) {
    case 'append':
      return true;

    case 'before-item':
    case 'after-item':
      return typeof value.itemId === 'string';

    default:
      return false;
  }
}
