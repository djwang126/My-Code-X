import type { JsonValue } from '../shared/index.js';

export type ClientTextBody = {
  readonly kind: 'text';
  readonly text: string;
};

export type ClientStructuredBody = {
  readonly kind: 'structured';
  readonly title: string;
  readonly entries: readonly ClientBodyEntry[];
};

export type ClientBodyEntry = {
  readonly label: string;
  readonly value: JsonValue;
};

export type ClientItemBody = ClientTextBody | ClientStructuredBody;

export type ClientItemLifecycle = 'queued' | 'running' | 'waiting' | 'complete' | 'failed' | 'cancelled';

export type ClientItemPlacement = 'conversation' | 'side-panel' | 'hidden';

export type ClientItemAction = {
  readonly id: string;
  readonly label: string;
  readonly style: 'primary' | 'normal' | 'danger';
};

export type ClientItemDetail =
  | { readonly kind: 'none' }
  | { readonly kind: 'inline'; readonly body: ClientItemBody }
  | { readonly kind: 'deferred'; readonly detailId: string; readonly revision: string };

export interface ClientConversationItemBase {
  readonly id: string;
  readonly lifecycle: ClientItemLifecycle;
  readonly placement: ClientItemPlacement;
  readonly body: ClientItemBody;
  readonly actions: readonly ClientItemAction[];
  readonly detail: ClientItemDetail;
}

export type ClientConversationItem =
  | ClientMessageItem
  | ClientReasoningItem
  | ClientPlanItem
  | ClientCommandItem
  | ClientFileChangeItem
  | ClientToolCallItem
  | ClientReviewItem
  | ClientNoticeItem
  | ClientErrorItem;

export interface ClientMessageItem extends ClientConversationItemBase {
  readonly kind: 'message';
  readonly role: 'user' | 'assistant' | 'system';
}

export interface ClientReasoningItem extends ClientConversationItemBase {
  readonly kind: 'reasoning';
}

export interface ClientPlanItem extends ClientConversationItemBase {
  readonly kind: 'plan';
}

export interface ClientCommandItem extends ClientConversationItemBase {
  readonly kind: 'command';
}

export interface ClientFileChangeItem extends ClientConversationItemBase {
  readonly kind: 'file-change';
}

export interface ClientToolCallItem extends ClientConversationItemBase {
  readonly kind: 'tool-call';
}

export interface ClientReviewItem extends ClientConversationItemBase {
  readonly kind: 'review';
}

export interface ClientNoticeItem extends ClientConversationItemBase {
  readonly kind: 'notice';
  readonly level: 'info' | 'warning' | 'error';
}

export interface ClientErrorItem extends ClientConversationItemBase {
  readonly kind: 'error';
}
