import type { ClientConversationItem } from './conversation-item.js';
import type { PendingInteraction } from './pending-interaction.js';
import type { ClientSnapshot, ClientNoticeView, ClientThreadView } from './client-snapshot.js';
import type { ClientTurnView } from './turn-view.js';

export type ClientEvent =
  | ClientSnapshotEvent
  | ClientConversationItemUpsertedEvent
  | ClientConversationItemPatchedEvent
  | ClientTurnChangedEvent
  | ClientThreadChangedEvent
  | ClientPendingInteractionOpenedEvent
  | ClientPendingInteractionClosedEvent
  | ClientNoticeAddedEvent
  | ClientErrorRaisedEvent;

export interface ClientEventBase {
  readonly scope: ClientEventScope;
  readonly revision: string;
}

export interface ClientEventScope {
  readonly slotId: string | null;
  readonly threadId: string | null;
}

export interface ClientSnapshotEvent extends ClientEventBase {
  readonly kind: 'snapshot';
  readonly snapshot: ClientSnapshot;
}

export interface ClientConversationItemUpsertedEvent extends ClientEventBase {
  readonly kind: 'conversation-item-upserted';
  readonly item: ClientConversationItem;
}

export interface ClientConversationItemPatchedEvent extends ClientEventBase {
  readonly kind: 'conversation-item-patched';
  readonly itemId: string;
  readonly patch: ClientConversationItem;
}

export interface ClientTurnChangedEvent extends ClientEventBase {
  readonly kind: 'turn-changed';
  readonly turn: ClientTurnView;
}

export interface ClientThreadChangedEvent extends ClientEventBase {
  readonly kind: 'thread-changed';
  readonly thread: ClientThreadView;
}

export interface ClientPendingInteractionOpenedEvent extends ClientEventBase {
  readonly kind: 'pending-interaction-opened';
  readonly interaction: PendingInteraction;
}

export interface ClientPendingInteractionClosedEvent extends ClientEventBase {
  readonly kind: 'pending-interaction-closed';
  readonly interactionId: string;
}

export interface ClientNoticeAddedEvent extends ClientEventBase {
  readonly kind: 'notice-added';
  readonly notice: ClientNoticeView;
}

export interface ClientErrorRaisedEvent extends ClientEventBase {
  readonly kind: 'error-raised';
  readonly message: string;
}
