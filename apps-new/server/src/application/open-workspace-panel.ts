import type { ClientActionResult, ClientOpenWorkspacePanelAction } from '@my-code-x/contracts-new';
import type { WorkspaceService } from '../features/workspace/index.js';
import { presentWorkspacePanel } from '../presenter/index.js';
import { workspaceActionAccepted, workspaceActionRejected } from './workspace-action-result.js';

export type OpenWorkspacePanelInput = ClientOpenWorkspacePanelAction;

export interface OpenWorkspacePanelDependencies {
  readonly workspace: WorkspaceService;
}

export interface OpenWorkspacePanelUseCaseInput {
  readonly input: OpenWorkspacePanelInput;
  readonly dependencies: OpenWorkspacePanelDependencies;
}

export async function openWorkspacePanel(useCase: OpenWorkspacePanelUseCaseInput): Promise<ClientActionResult> {
  try {
    const list = await useCase.dependencies.workspace.openList({
      selectedWorkspaceId: useCase.input.scope.workspaceId,
    });
    return workspaceActionAccepted(presentWorkspacePanel({ list }));
  } catch (error) {
    return workspaceActionRejected(error);
  }
}
