import type { ClientActionResult, ClientRemoveWorkspaceAction } from '@my-code-x/contracts-new';
import type { WorkspaceService } from '../features/workspace/index.js';
import { presentWorkspacePanel } from '../presenter/index.js';
import { workspaceActionAccepted, workspaceActionRejected } from './workspace-action-result.js';

export type RemoveWorkspaceInput = ClientRemoveWorkspaceAction;

export interface RemoveWorkspaceDependencies {
  readonly workspace: WorkspaceService;
}

export interface RemoveWorkspaceUseCaseInput {
  readonly input: RemoveWorkspaceInput;
  readonly dependencies: RemoveWorkspaceDependencies;
}

export async function removeWorkspace(useCase: RemoveWorkspaceUseCaseInput): Promise<ClientActionResult> {
  try {
    const list = await useCase.dependencies.workspace.remove({
      recordRef: useCase.input.payload.recordRef,
      currentWorkspaceId: useCase.input.payload.currentWorkspaceId,
      selectedWorkspaceId: useCase.input.scope.workspaceId,
    });
    return workspaceActionAccepted(presentWorkspacePanel({ list }));
  } catch (error) {
    return workspaceActionRejected(error);
  }
}
