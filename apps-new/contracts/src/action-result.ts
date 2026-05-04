import { z } from 'zod';
import { clientEventSchema, type ClientEvent } from './client-event.js';
import { clientSnapshotSchema, type ClientSnapshot } from './client-snapshot.js';
import { clientWorkspacePanelViewSchema, type ClientWorkspacePanelView } from './workspace-panel.js';

export const clientActionErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
}).strict();

export const clientActionResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('accepted'),
    snapshot: clientSnapshotSchema.nullable(),
    events: z.array(clientEventSchema),
    workspacePanel: clientWorkspacePanelViewSchema.nullable(),
  }).strict(),
  z.object({
    status: z.literal('rejected'),
    error: clientActionErrorSchema,
  }).strict(),
]);

type ClientActionResultShape = z.infer<typeof clientActionResultSchema>;

type ClientAcceptedActionResult = Readonly<
  Omit<Extract<ClientActionResultShape, { readonly status: 'accepted' }>, 'snapshot' | 'events' | 'workspacePanel'> & {
    readonly snapshot: ClientSnapshot | null;
    readonly events: readonly ClientEvent[];
    readonly workspacePanel: ClientWorkspacePanelView | null;
  }
>;
type ClientRejectedActionResult = Readonly<Extract<ClientActionResultShape, { readonly status: 'rejected' }>>;

export type ClientActionError = Readonly<z.infer<typeof clientActionErrorSchema>>;
export type ClientActionResult = ClientAcceptedActionResult | ClientRejectedActionResult;
