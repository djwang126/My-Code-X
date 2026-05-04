import type { ClientActionError, ClientActionResult, ClientWorkspacePanelView } from '@my-code-x/contracts-new';
import { WorkspaceConflictError, WorkspacePersistenceError, WorkspaceValidationError } from '../features/workspace/index.js';

export function workspaceActionAccepted(workspacePanel: ClientWorkspacePanelView): ClientActionResult {
  return {
    status: 'accepted',
    snapshot: null,
    events: [],
    workspacePanel,
  };
}

export function workspaceActionRejected(error: unknown): ClientActionResult {
  if (error instanceof WorkspaceValidationError || error instanceof WorkspaceConflictError || error instanceof WorkspacePersistenceError) {
    return rejected({
      code: error.code,
      message: error.message,
    });
  }

  throw error;
}

function rejected(error: ClientActionError): ClientActionResult {
  return {
    status: 'rejected',
    error,
  };
}
