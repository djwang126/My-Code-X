import type { ClientEvent, ClientEventScope, ClientSnapshot } from '@my-code-x/contracts-new';
import { SkeletonMigrationPendingError } from '../shared/index.js';

export interface CreateClientEventInput {
  readonly kind: ClientEvent['kind'];
  readonly scope: ClientEventScope;
  readonly revision: string;
  readonly snapshot: ClientSnapshot | null;
}

export function createClientEvent(input: CreateClientEventInput): ClientEvent {
  if (input.kind === 'snapshot' && input.snapshot) {
    return {
      kind: 'snapshot',
      scope: input.scope,
      revision: input.revision,
      snapshot: input.snapshot,
    };
  }

  throw new SkeletonMigrationPendingError(`client event presenter for ${input.kind}`);
}
