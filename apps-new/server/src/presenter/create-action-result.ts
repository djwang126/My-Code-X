import type { ClientActionError, ClientActionResult, ClientEvent, ClientSnapshot, ClientWorkspacePanelView } from '@my-code-x/contracts-new';

export type CreateActionResultInput = CreateAcceptedActionResultInput | CreateRejectedActionResultInput;

export interface CreateAcceptedActionResultInput {
  readonly status: 'accepted';
  readonly snapshot: ClientSnapshot | null;
  readonly events: readonly ClientEvent[];
  readonly workspacePanel?: ClientWorkspacePanelView | null;
}

export interface CreateRejectedActionResultInput {
  readonly status: 'rejected';
  readonly error: ClientActionError;
}

export function createActionResult(input: CreateActionResultInput): ClientActionResult {
  if (input.status === 'rejected') {
    return {
      status: 'rejected',
      error: input.error,
    };
  }

  return {
    status: 'accepted',
    snapshot: input.snapshot,
    events: input.events,
    workspacePanel: input.workspacePanel ?? null,
  };
}
