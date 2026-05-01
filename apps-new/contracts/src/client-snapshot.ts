import { z } from 'zod';
import { clientConversationViewSchema, type ClientConversationView } from './conversation-view.js';
import { jsonValueSchema, type JsonValue } from './json.js';
import { pendingInteractionSchema, type PendingInteraction } from './pending-interaction.js';
import { clientTurnViewSchema, type ClientTurnView } from './turn-view.js';

export type { ClientConversationView } from './conversation-view.js';

export const clientAppViewSchema = z.object({
  status: z.enum(['ready', 'degraded', 'unavailable']),
}).strict();

export const clientIdentityViewSchema = z.object({
  slotId: z.string(),
}).strict();

export const clientSelectionViewSchema = z.object({
  workspaceId: z.string().nullable(),
  threadId: z.string().nullable(),
}).strict();

export const clientWorkspaceViewSchema = z.object({
  status: z.enum(['none', 'selected', 'unavailable']),
}).strict();

export const clientThreadViewSchema = z.object({
  status: z.enum(['none', 'opening', 'ready', 'archived', 'failed']),
  title: z.string().nullable(),
}).strict();

export const clientNoticeViewSchema = z.object({
  id: z.string(),
  level: z.enum(['info', 'warning', 'error']),
  title: z.string(),
  body: z.string(),
}).strict();

export const clientCapabilitiesViewSchema = z.object({
  actions: z.array(z.string()),
  options: jsonValueSchema,
}).strict();

export const clientStreamViewSchema = z.object({
  status: z.enum(['disabled', 'available']),
  revision: z.string(),
}).strict();

export const clientSnapshotSchema = z.object({
  app: clientAppViewSchema,
  identity: clientIdentityViewSchema,
  selection: clientSelectionViewSchema,
  workspace: clientWorkspaceViewSchema,
  thread: clientThreadViewSchema,
  turn: clientTurnViewSchema,
  conversation: clientConversationViewSchema,
  pendingInteractions: z.array(pendingInteractionSchema),
  notices: z.array(clientNoticeViewSchema),
  capabilities: clientCapabilitiesViewSchema,
  stream: clientStreamViewSchema,
}).strict();

type ClientCapabilitiesViewShape = z.infer<typeof clientCapabilitiesViewSchema>;
type ClientSnapshotShape = z.infer<typeof clientSnapshotSchema>;

export type ClientAppView = Readonly<z.infer<typeof clientAppViewSchema>>;
export type ClientIdentityView = Readonly<z.infer<typeof clientIdentityViewSchema>>;
export type ClientSelectionView = Readonly<z.infer<typeof clientSelectionViewSchema>>;
export type ClientWorkspaceView = Readonly<z.infer<typeof clientWorkspaceViewSchema>>;
export type ClientThreadView = Readonly<z.infer<typeof clientThreadViewSchema>>;
export type ClientNoticeView = Readonly<z.infer<typeof clientNoticeViewSchema>>;
export type ClientCapabilitiesView = Readonly<
  Omit<ClientCapabilitiesViewShape, 'actions' | 'options'> & {
    readonly actions: readonly string[];
    readonly options: JsonValue;
  }
>;
export type ClientStreamView = Readonly<z.infer<typeof clientStreamViewSchema>>;

export type ClientSnapshot = Readonly<
  Omit<
    ClientSnapshotShape,
    'app' | 'identity' | 'selection' | 'workspace' | 'thread' | 'turn' | 'conversation' | 'pendingInteractions' | 'notices' | 'capabilities' | 'stream'
  > & {
    readonly app: ClientAppView;
    readonly identity: ClientIdentityView;
    readonly selection: ClientSelectionView;
    readonly workspace: ClientWorkspaceView;
    readonly thread: ClientThreadView;
    readonly turn: ClientTurnView;
    readonly conversation: ClientConversationView;
    readonly pendingInteractions: readonly PendingInteraction[];
    readonly notices: readonly ClientNoticeView[];
    readonly capabilities: ClientCapabilitiesView;
    readonly stream: ClientStreamView;
  }
>;
