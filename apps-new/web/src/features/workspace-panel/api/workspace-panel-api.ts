import type { ClientAction, ClientActionResult, ClientWorkspacePanelView } from '@my-code-x/contracts-new';
import type { AppScope } from '../../../app/app-scope.js';

export interface WorkspacePanelApiBoundary {
  open(input: OpenWorkspacePanelInput): Promise<ClientWorkspacePanelView>;
  add(input: AddWorkspaceInput): Promise<ClientWorkspacePanelView>;
  rename(input: RenameWorkspaceInput): Promise<ClientWorkspacePanelView>;
  editCwd(input: EditWorkspaceCwdInput): Promise<ClientWorkspacePanelView>;
  remove(input: RemoveWorkspaceInput): Promise<ClientWorkspacePanelView>;
}

export class WorkspacePanelApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'WorkspacePanelApiError';
  }
}

export interface WorkspacePanelApiDependencies {
  sendAction(action: ClientAction): Promise<ClientActionResult>;
}

export interface OpenWorkspacePanelInput {
  readonly scope: AppScope;
}

export interface AddWorkspaceInput {
  readonly scope: AppScope;
  readonly cwd: string;
  readonly name: string;
}

export interface RenameWorkspaceInput {
  readonly scope: AppScope;
  readonly recordRef: string | null;
  readonly currentWorkspaceId: string;
  readonly name: string;
}

export interface EditWorkspaceCwdInput {
  readonly scope: AppScope;
  readonly recordRef: string | null;
  readonly currentWorkspaceId: string;
  readonly cwd: string;
}

export interface RemoveWorkspaceInput {
  readonly scope: AppScope;
  readonly recordRef: string | null;
  readonly currentWorkspaceId: string;
}

export function createWorkspacePanelApiBoundary(dependencies: WorkspacePanelApiDependencies): WorkspacePanelApiBoundary {
  return {
    open(input) {
      return sendWorkspaceAction(dependencies, {
        kind: 'open-workspace-panel',
        scope: createActionScope(input.scope),
        payload: {},
      });
    },
    add(input) {
      return sendWorkspaceAction(dependencies, {
        kind: 'add-workspace',
        scope: createActionScope(input.scope),
        payload: {
          cwd: input.cwd,
          name: input.name,
        },
      });
    },
    rename(input) {
      return sendWorkspaceAction(dependencies, {
        kind: 'rename-workspace',
        scope: createActionScope(input.scope),
        payload: {
          recordRef: input.recordRef,
          currentWorkspaceId: input.currentWorkspaceId,
          name: input.name,
        },
      });
    },
    editCwd(input) {
      return sendWorkspaceAction(dependencies, {
        kind: 'edit-workspace-cwd',
        scope: createActionScope(input.scope),
        payload: {
          recordRef: input.recordRef,
          currentWorkspaceId: input.currentWorkspaceId,
          cwd: input.cwd,
        },
      });
    },
    remove(input) {
      return sendWorkspaceAction(dependencies, {
        kind: 'remove-workspace',
        scope: createActionScope(input.scope),
        payload: {
          recordRef: input.recordRef,
          currentWorkspaceId: input.currentWorkspaceId,
        },
      });
    },
  };
}

async function sendWorkspaceAction(dependencies: WorkspacePanelApiDependencies, action: ClientAction): Promise<ClientWorkspacePanelView> {
  const result = await dependencies.sendAction(action);
  if (result.status === 'rejected') {
    throw new WorkspacePanelApiError(result.error.code, result.error.message);
  }

  if (result.workspacePanel === null) {
    throw new Error('Workspace action did not return a panel');
  }

  return result.workspacePanel;
}

function createActionScope(scope: AppScope): ClientAction['scope'] {
  return {
    slotId: scope.slotId,
    workspaceId: scope.workspaceId,
    threadId: scope.threadId,
  };
}
