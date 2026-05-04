import { useReducer } from 'react';
import type { ClientWorkspaceListItemView, ClientWorkspacePanelView } from '@my-code-x/contracts-new';
import type { AppScope } from '../../../app/app-scope.js';
import type { WorkspacePanelApiBoundary } from '../api/workspace-panel-api.js';
import {
  createInitialWorkspacePanelState,
  reduceWorkspacePanelState,
  type WorkspacePanelState,
} from './workspace-panel-reducer.js';
import type {
  WorkspaceAddSubmitInput,
  WorkspaceEditCwdSubmitInput,
  WorkspaceRenameSubmitInput,
} from './workspace-panel-inputs.js';

export interface UseWorkspacePanelControllerInput {
  readonly scope: AppScope;
  readonly api: WorkspacePanelApiBoundary;
}

export interface WorkspacePanelController {
  readonly state: WorkspacePanelState;
  open(): void;
  close(): void;
  openAddModal(): void;
  openRenameModal(item: ClientWorkspaceListItemView): void;
  openEditCwdModal(item: ClientWorkspaceListItemView): void;
  submitAdd(input: WorkspaceAddSubmitInput): void;
  submitRename(input: WorkspaceRenameSubmitInput): void;
  submitEditCwd(input: WorkspaceEditCwdSubmitInput): void;
  remove(item: ClientWorkspaceListItemView): void;
}

export function useWorkspacePanelController(input: UseWorkspacePanelControllerInput): WorkspacePanelController {
  const [state, dispatch] = useReducer(reduceWorkspacePanelState, undefined, createInitialWorkspacePanelState);

  function open(): void {
    dispatch({ kind: 'open-started' });
    input.api.open({ scope: input.scope })
      .then(panel => {
        if (panel.status !== 'ready') {
          dispatch({ kind: 'open-failed', message: 'Workspace 列表加载失败' });
          return;
        }

        dispatch({ kind: 'open-succeeded', panel });
      })
      .catch(error => dispatch({ kind: 'open-failed', message: readErrorMessage(error) }));
  }

  function submitAdd(submitInput: WorkspaceAddSubmitInput): void {
    const actionScope = createWorkspacePanelActionScope({ appScope: input.scope, state });
    dispatch({ kind: 'submit-started' });
    input.api.add({ scope: actionScope, cwd: submitInput.cwd, name: submitInput.name })
      .then(panel => dispatchWorkspaceMutationSuccess(panel))
      .catch(error => dispatch({ kind: 'submit-failed', message: readErrorMessage(error) }));
  }

  function submitRename(submitInput: WorkspaceRenameSubmitInput): void {
    const actionScope = createWorkspacePanelActionScope({ appScope: input.scope, state });
    dispatch({ kind: 'submit-started' });
    input.api.rename({
      scope: actionScope,
      recordRef: submitInput.item.recordRef,
      currentWorkspaceId: submitInput.item.workspaceId,
      name: submitInput.name,
    })
      .then(panel => dispatchWorkspaceMutationSuccess(panel))
      .catch(error => dispatch({ kind: 'submit-failed', message: readErrorMessage(error) }));
  }

  function submitEditCwd(submitInput: WorkspaceEditCwdSubmitInput): void {
    const actionScope = createWorkspacePanelActionScope({ appScope: input.scope, state });
    dispatch({ kind: 'submit-started' });
    input.api.editCwd({
      scope: actionScope,
      recordRef: submitInput.item.recordRef,
      currentWorkspaceId: submitInput.item.workspaceId,
      cwd: submitInput.cwd,
    })
      .then(panel => dispatchWorkspaceMutationSuccess(panel))
      .catch(error => dispatch({ kind: 'submit-failed', message: readErrorMessage(error) }));
  }

  function remove(item: ClientWorkspaceListItemView): void {
    const actionScope = createWorkspacePanelActionScope({ appScope: input.scope, state });
    input.api.remove({
      scope: actionScope,
      recordRef: item.recordRef,
      currentWorkspaceId: item.workspaceId,
    })
      .then(panel => dispatchWorkspaceMutationSuccess(panel))
      .catch(error => dispatch({ kind: 'list-action-failed', message: readErrorMessage(error) }));
  }

  function dispatchWorkspaceMutationSuccess(panel: ClientWorkspacePanelView): void {
    if (panel.status !== 'ready') {
      dispatch({ kind: 'submit-failed', message: 'Workspace 操作没有返回列表' });
      return;
    }

    dispatch({ kind: 'submit-succeeded', panel });
  }

  return {
    state,
    open,
    close() {
      dispatch({ kind: 'close-requested' });
    },
    openAddModal() {
      dispatch({ kind: 'open-add-modal' });
    },
    openRenameModal(item) {
      dispatch({ kind: 'open-rename-modal', item });
    },
    openEditCwdModal(item) {
      dispatch({ kind: 'open-edit-cwd-modal', item });
    },
    submitAdd,
    submitRename,
    submitEditCwd,
    remove,
  };
}

interface CreateWorkspacePanelActionScopeInput {
  readonly appScope: AppScope;
  readonly state: WorkspacePanelState;
}

function createWorkspacePanelActionScope(input: CreateWorkspacePanelActionScopeInput): AppScope {
  if (input.state.status !== 'ready') {
    return input.appScope;
  }

  return {
    ...input.appScope,
    workspaceId: input.state.panel.list.selectedWorkspaceId,
  };
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Workspace 操作失败';
}
