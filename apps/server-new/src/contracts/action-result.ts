import type { ClientEvent } from './client-event.js';
import type { ClientSnapshot } from './client-snapshot.js';

export type ClientActionResult =
  | { readonly status: 'accepted'; readonly snapshot: ClientSnapshot | null; readonly events: readonly ClientEvent[] }
  | { readonly status: 'rejected'; readonly message: string };
