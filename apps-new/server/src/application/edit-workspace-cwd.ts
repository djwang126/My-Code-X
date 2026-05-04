import type { ClientActionResult, ClientEditWorkspaceCwdAction } from '@my-code-x/contracts-new';
import type { WorkspaceService } from '../features/workspace/index.js';
import { presentWorkspacePanel } from '../presenter/index.js';
import { workspaceActionAccepted, workspaceActionRejected } from './workspace-action-result.js';

export type EditWorkspaceCwdInput = ClientEditWorkspaceCwdAction;

export interface EditWorkspaceCwdDependencies {
  readonly workspace: WorkspaceService;
}

export interface EditWorkspaceCwdUseCaseInput {
  readonly input: EditWorkspaceCwdInput;
  readonly dependencies: EditWorkspaceCwdDependencies;
}

export async function editWorkspaceCwd(useCase: EditWorkspaceCwdUseCaseInput): Promise<ClientActionResult> {
  try {
    const list = await useCase.dependencies.workspace.editCwd({
      recordRef: useCase.input.payload.recordRef,
      currentWorkspaceId: useCase.input.payload.currentWorkspaceId,
      cwd: useCase.input.payload.cwd,
      selectedWorkspaceId: useCase.input.scope.workspaceId,
    });
    return workspaceActionAccepted(presentWorkspacePanel({ list }));
  } catch (error) {
    return workspaceActionRejected(error);
  }
}
