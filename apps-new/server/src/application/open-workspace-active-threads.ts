import type { ClientActionResult, ClientOpenWorkspaceActiveThreadsAction } from '@my-code-x/contracts-new';
import type { WorkspaceService } from '../features/workspace/index.js';
import type { RuntimePort } from '../ports/index.js';
import { presentWorkspacePanel } from '../presenter/index.js';
import { findSelectedAvailableWorkspace } from './open-workspace-panel.js';
import { createActiveThreadPage } from './workspace-active-thread-page.js';
import { workspaceUnavailableRejected } from './workspace-action-result.js';

export type OpenWorkspaceActiveThreadsInput = ClientOpenWorkspaceActiveThreadsAction;

export interface OpenWorkspaceActiveThreadsDependencies {
  readonly workspace: WorkspaceService;
  readonly runtime: RuntimePort;
}

export interface OpenWorkspaceActiveThreadsUseCaseInput {
  readonly input: OpenWorkspaceActiveThreadsInput;
  readonly dependencies: OpenWorkspaceActiveThreadsDependencies;
}

export async function openWorkspaceActiveThreads(useCase: OpenWorkspaceActiveThreadsUseCaseInput): Promise<ClientActionResult> {
  const list = await useCase.dependencies.workspace.openList({
    selectedWorkspaceId: useCase.input.payload.workspaceId,
  });
  const selectedWorkspace = findSelectedAvailableWorkspace(list);

  if (!selectedWorkspace) {
    return workspaceUnavailableRejected();
  }

  const page = await createActiveThreadPage({
    runtime: useCase.dependencies.runtime,
    workspace: selectedWorkspace,
    currentThreadId: useCase.input.scope.threadId,
    cursor: null,
  });

  return {
    status: 'accepted',
    snapshot: null,
    events: [],
    workspacePanel: presentWorkspacePanel({ list, page }),
  };
}
