import type { ClientActionResult, ClientRenameWorkspaceAction } from '@my-code-x/contracts-new';
import type { WorkspaceService } from '../features/workspace/index.js';
import { presentWorkspacePanel } from '../presenter/index.js';
import { workspaceActionAccepted, workspaceActionRejected } from './workspace-action-result.js';

export type RenameWorkspaceInput = ClientRenameWorkspaceAction;

export interface RenameWorkspaceDependencies {
  readonly workspace: WorkspaceService;
}

export interface RenameWorkspaceUseCaseInput {
  readonly input: RenameWorkspaceInput;
  readonly dependencies: RenameWorkspaceDependencies;
}

export async function renameWorkspace(useCase: RenameWorkspaceUseCaseInput): Promise<ClientActionResult> {
  try {
    const list = await useCase.dependencies.workspace.rename({
      recordRef: useCase.input.payload.recordRef,
      currentWorkspaceId: useCase.input.payload.currentWorkspaceId,
      name: useCase.input.payload.name,
      selectedWorkspaceId: useCase.input.scope.workspaceId,
    });
    return workspaceActionAccepted(presentWorkspacePanel({ list }));
  } catch (error) {
    return workspaceActionRejected(error);
  }
}
