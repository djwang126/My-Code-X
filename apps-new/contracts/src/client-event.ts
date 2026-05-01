import { z } from 'zod';
import {
  clientNoticeViewSchema,
  clientSnapshotSchema,
  clientThreadViewSchema,
  type ClientNoticeView,
  type ClientSnapshot,
  type ClientThreadView,
} from './client-snapshot.js';
import { clientConversationItemSchema, type ClientConversationItem } from './conversation-view.js';
import { pendingInteractionSchema, type PendingInteraction } from './pending-interaction.js';
import { clientTurnViewSchema, type ClientTurnView } from './turn-view.js';

export const clientEventScopeSchema = z.object({
  slotId: z.string().nullable(),
  threadId: z.string().nullable(),
}).strict();

const clientSnapshotEventSchema = z.object({
  kind: z.literal('snapshot'),
  scope: clientEventScopeSchema,
  revision: z.string(),
  snapshot: clientSnapshotSchema,
}).strict();

const clientConversationItemUpsertedEventSchema = z.object({
  kind: z.literal('conversation-item-upserted'),
  scope: clientEventScopeSchema,
  revision: z.string(),
  item: clientConversationItemSchema,
}).strict();

const clientConversationItemPatchedEventSchema = z.object({
  kind: z.literal('conversation-item-patched'),
  scope: clientEventScopeSchema,
  revision: z.string(),
  itemId: z.string(),
  patch: clientConversationItemSchema,
}).strict();

const clientTurnChangedEventSchema = z.object({
  kind: z.literal('turn-changed'),
  scope: clientEventScopeSchema,
  revision: z.string(),
  turn: clientTurnViewSchema,
}).strict();

const clientThreadChangedEventSchema = z.object({
  kind: z.literal('thread-changed'),
  scope: clientEventScopeSchema,
  revision: z.string(),
  thread: clientThreadViewSchema,
}).strict();

const clientPendingInteractionOpenedEventSchema = z.object({
  kind: z.literal('pending-interaction-opened'),
  scope: clientEventScopeSchema,
  revision: z.string(),
  interaction: pendingInteractionSchema,
}).strict();

const clientPendingInteractionClosedEventSchema = z.object({
  kind: z.literal('pending-interaction-closed'),
  scope: clientEventScopeSchema,
  revision: z.string(),
  interactionId: z.string(),
}).strict();

const clientNoticeAddedEventSchema = z.object({
  kind: z.literal('notice-added'),
  scope: clientEventScopeSchema,
  revision: z.string(),
  notice: clientNoticeViewSchema,
}).strict();

const clientErrorRaisedEventSchema = z.object({
  kind: z.literal('error-raised'),
  scope: clientEventScopeSchema,
  revision: z.string(),
  message: z.string(),
}).strict();

export const clientEventSchema = z.discriminatedUnion('kind', [
  clientSnapshotEventSchema,
  clientConversationItemUpsertedEventSchema,
  clientConversationItemPatchedEventSchema,
  clientTurnChangedEventSchema,
  clientThreadChangedEventSchema,
  clientPendingInteractionOpenedEventSchema,
  clientPendingInteractionClosedEventSchema,
  clientNoticeAddedEventSchema,
  clientErrorRaisedEventSchema,
]);

export type ClientEventScope = Readonly<z.infer<typeof clientEventScopeSchema>>;

type ClientEventShape = z.infer<typeof clientEventSchema>;

type ClientEventBaseShape<Kind extends ClientEventShape['kind']> = Extract<ClientEventShape, { readonly kind: Kind }>;

export type ClientSnapshotEvent = Readonly<
  Omit<ClientEventBaseShape<'snapshot'>, 'scope' | 'snapshot'> & {
    readonly scope: ClientEventScope;
    readonly snapshot: ClientSnapshot;
  }
>;
export type ClientConversationItemUpsertedEvent = Readonly<
  Omit<ClientEventBaseShape<'conversation-item-upserted'>, 'scope' | 'item'> & {
    readonly scope: ClientEventScope;
    readonly item: ClientConversationItem;
  }
>;
export type ClientConversationItemPatchedEvent = Readonly<
  Omit<ClientEventBaseShape<'conversation-item-patched'>, 'scope' | 'patch'> & {
    readonly scope: ClientEventScope;
    readonly patch: ClientConversationItem;
  }
>;
export type ClientTurnChangedEvent = Readonly<
  Omit<ClientEventBaseShape<'turn-changed'>, 'scope' | 'turn'> & {
    readonly scope: ClientEventScope;
    readonly turn: ClientTurnView;
  }
>;
export type ClientThreadChangedEvent = Readonly<
  Omit<ClientEventBaseShape<'thread-changed'>, 'scope' | 'thread'> & {
    readonly scope: ClientEventScope;
    readonly thread: ClientThreadView;
  }
>;
export type ClientPendingInteractionOpenedEvent = Readonly<
  Omit<ClientEventBaseShape<'pending-interaction-opened'>, 'scope' | 'interaction'> & {
    readonly scope: ClientEventScope;
    readonly interaction: PendingInteraction;
  }
>;
export type ClientPendingInteractionClosedEvent = Readonly<
  Omit<ClientEventBaseShape<'pending-interaction-closed'>, 'scope'> & {
    readonly scope: ClientEventScope;
  }
>;
export type ClientNoticeAddedEvent = Readonly<
  Omit<ClientEventBaseShape<'notice-added'>, 'scope' | 'notice'> & {
    readonly scope: ClientEventScope;
    readonly notice: ClientNoticeView;
  }
>;
export type ClientErrorRaisedEvent = Readonly<
  Omit<ClientEventBaseShape<'error-raised'>, 'scope'> & {
    readonly scope: ClientEventScope;
  }
>;

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
