import { z } from 'zod';
import {
  clientNoticeViewSchema,
  clientSnapshotSchema,
  clientThreadViewSchema,
  type ClientNoticeView,
  type ClientSnapshot,
  type ClientThreadView,
} from './client-snapshot.js';
import {
  clientConversationViewSchema,
  clientConversationItemSchema,
  type ClientConversationItem,
  type ClientConversationView,
} from './conversation-view.js';
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

const clientConversationReplacedEventSchema = z.object({
  kind: z.literal('conversation-replaced'),
  scope: clientEventScopeSchema,
  revision: z.string(),
  conversation: clientConversationViewSchema,
}).strict();


export const clientConversationTimelinePositionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('append'),
  }).strict(),
  z.object({
    kind: z.literal('before-item'),
    itemId: z.string(),
  }).strict(),
  z.object({
    kind: z.literal('after-item'),
    itemId: z.string(),
  }).strict(),
]);

const clientConversationItemUpsertedEventSchema = z.object({
  kind: z.literal('conversation-item-upserted'),
  scope: clientEventScopeSchema,
  revision: z.string(),
  item: clientConversationItemSchema,
  position: clientConversationTimelinePositionSchema,
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
  clientConversationReplacedEventSchema,
  clientConversationItemUpsertedEventSchema,
  clientTurnChangedEventSchema,
  clientThreadChangedEventSchema,
  clientPendingInteractionOpenedEventSchema,
  clientPendingInteractionClosedEventSchema,
  clientNoticeAddedEventSchema,
  clientErrorRaisedEventSchema,
]);

export type ClientEventScope = Readonly<z.infer<typeof clientEventScopeSchema>>;
export type ClientConversationTimelinePosition = Readonly<z.infer<typeof clientConversationTimelinePositionSchema>>;

type ClientEventShape = z.infer<typeof clientEventSchema>;

type ClientEventBaseShape<Kind extends ClientEventShape['kind']> = Extract<ClientEventShape, { readonly kind: Kind }>;

export type ClientSnapshotEvent = Readonly<
  Omit<ClientEventBaseShape<'snapshot'>, 'scope' | 'snapshot'> & {
    readonly scope: ClientEventScope;
    readonly snapshot: ClientSnapshot;
  }
>;

export type ClientConversationReplacedEvent = Readonly<
  Omit<ClientEventBaseShape<'conversation-replaced'>, 'scope' | 'conversation'> & {
    readonly scope: ClientEventScope;
    readonly conversation: ClientConversationView;
  }
>;
export type ClientConversationItemUpsertedEvent = Readonly<
  Omit<ClientEventBaseShape<'conversation-item-upserted'>, 'scope' | 'item' | 'position'> & {
    readonly scope: ClientEventScope;
    readonly item: ClientConversationItem;
    readonly position: ClientConversationTimelinePosition;
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
  | ClientConversationReplacedEvent
  | ClientConversationItemUpsertedEvent
  | ClientTurnChangedEvent
  | ClientThreadChangedEvent
  | ClientPendingInteractionOpenedEvent
  | ClientPendingInteractionClosedEvent
  | ClientNoticeAddedEvent
  | ClientErrorRaisedEvent;
