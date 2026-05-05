import type { ClientActionResult, ClientOpenWorkspacePanelAction } from '@my-code-x/contracts-new';
import type { WorkspaceListItem, WorkspaceListSnapshot, WorkspaceService } from '../features/workspace/index.js';
import type { RuntimePort } from '../ports/index.js';
import { presentWorkspacePanel } from '../presenter/index.js';
import { createActiveThreadPage, type ActiveThreadWorkspace } from './workspace-active-thread-page.js';
import { workspaceActionAccepted, workspaceActionRejected } from './workspace-action-result.js';

export type OpenWorkspacePanelInput = ClientOpenWorkspacePanelAction;

export interface OpenWorkspacePanelDependencies {
  readonly workspace: WorkspaceService;
  readonly runtime: RuntimePort;
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
    const selectedWorkspace = findSelectedAvailableWorkspace(list);
    if (!selectedWorkspace) {
      return workspaceActionAccepted(presentWorkspacePanel({ list }));
    }

    const page = await createActiveThreadPage({
      runtime: useCase.dependencies.runtime,
      workspace: selectedWorkspace,
      currentThreadId: useCase.input.scope.threadId,
      cursor: null,
    });
    return workspaceActionAccepted(presentWorkspacePanel({ list, page }));
  } catch (error) {
    return workspaceActionRejected(error);
  }
}

export function findSelectedAvailableWorkspace(list: WorkspaceListSnapshot): ActiveThreadWorkspace | null {
  if (list.selectedWorkspaceId === null) {
    return null;
  }

  const selectedWorkspace = list.items.find(item => item.workspaceId === list.selectedWorkspaceId);
  if (!selectedWorkspace || selectedWorkspace.availability.status !== 'available') {
    return null;
  }

  return createActiveThreadWorkspace(selectedWorkspace);
}

function createActiveThreadWorkspace(item: WorkspaceListItem): ActiveThreadWorkspace {
  return {
    workspaceId: item.workspaceId,
    name: item.name,
    cwd: item.cwd,
  };
}
