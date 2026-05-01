import { z } from 'zod';
import { clientEventSchema, type ClientEvent } from './client-event.js';
import { clientSnapshotSchema, type ClientSnapshot } from './client-snapshot.js';

export const clientActionResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('accepted'),
    snapshot: clientSnapshotSchema.nullable(),
    events: z.array(clientEventSchema),
  }).strict(),
  z.object({
    status: z.literal('rejected'),
    message: z.string(),
  }).strict(),
]);

type ClientActionResultShape = z.infer<typeof clientActionResultSchema>;

type ClientAcceptedActionResult = Readonly<
  Omit<Extract<ClientActionResultShape, { readonly status: 'accepted' }>, 'snapshot' | 'events'> & {
    readonly snapshot: ClientSnapshot | null;
    readonly events: readonly ClientEvent[];
  }
>;
type ClientRejectedActionResult = Readonly<Extract<ClientActionResultShape, { readonly status: 'rejected' }>>;

export type ClientActionResult = ClientAcceptedActionResult | ClientRejectedActionResult;
