import type { ClientActionResult, ClientAddWorkspaceAction } from '@my-code-x/contracts-new';
import type { WorkspaceService } from '../features/workspace/index.js';
import { presentWorkspacePanel } from '../presenter/index.js';
import { workspaceActionAccepted, workspaceActionRejected } from './workspace-action-result.js';

export type AddWorkspaceInput = ClientAddWorkspaceAction;

export interface AddWorkspaceDependencies {
  readonly workspace: WorkspaceService;
}

export interface AddWorkspaceUseCaseInput {
  readonly input: AddWorkspaceInput;
  readonly dependencies: AddWorkspaceDependencies;
}

export async function addWorkspace(useCase: AddWorkspaceUseCaseInput): Promise<ClientActionResult> {
  try {
    const list = await useCase.dependencies.workspace.add({
      cwd: useCase.input.payload.cwd,
      name: useCase.input.payload.name,
      selectedWorkspaceId: useCase.input.scope.workspaceId,
    });
    return workspaceActionAccepted(presentWorkspacePanel({ list }));
  } catch (error) {
    return workspaceActionRejected(error);
  }
}
