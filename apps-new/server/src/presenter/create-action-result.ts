import type { ClientActionResult, ClientEvent, ClientSnapshot } from '@my-code-x/contracts-new';

export interface CreateActionResultInput {
  readonly accepted: boolean;
  readonly message: string | null;
  readonly snapshot: ClientSnapshot | null;
  readonly events: readonly ClientEvent[];
}

export function createActionResult(input: CreateActionResultInput): ClientActionResult {
  if (!input.accepted) {
    return {
      status: 'rejected',
      message: input.message ?? 'Action rejected',
    };
  }

  return {
    status: 'accepted',
    snapshot: input.snapshot,
    events: input.events,
  };
}
