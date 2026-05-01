import type { PendingInteraction } from '@my-code-x/contracts-new';
import type { RuntimeRequest, RuntimeRequestSnapshot } from '../features/runtime-request/index.js';
import { SkeletonMigrationPendingError } from '../shared/index.js';

export interface PresentPendingInteractionsInput {
  readonly snapshot: RuntimeRequestSnapshot;
}

export function presentPendingInteractions(input: PresentPendingInteractionsInput): readonly PendingInteraction[] {
  return input.snapshot.requests.map(request => presentPendingInteraction({ request }));
}

export interface PresentPendingInteractionInput {
  readonly request: RuntimeRequest;
}

export function presentPendingInteraction(input: PresentPendingInteractionInput): PendingInteraction {
  throw new SkeletonMigrationPendingError(`pending interaction presenter for ${input.request.kind}`);
}
