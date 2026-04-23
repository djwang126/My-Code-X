import type { Dispatch, SetStateAction } from 'react';

import type { WorkspaceFileEntry } from '../public-types';
import { openWorkspaceDirectory, openWorkspaceFile } from '../lib/workspace-file-explorer-helpers';
import type { WorkspaceExplorerMutators } from './useWorkspaceExplorerState';
import type { RunWorkspaceExplorerAction } from './createWorkspaceExplorerActionRunner';
import { confirmDiscardWorkspaceChanges, requireWorkspaceSelection } from './workspaceExplorerPolicies';

interface CreateWorkspaceExplorerNavigationInput {
  mutators: WorkspaceExplorerMutators;
  onError: (message: string, kind?: 'workspace-file-open' | 'workspace-file-save') => boolean;
  runWorkspaceExplorerAction: RunWorkspaceExplorerAction;
  workspace: string;
  workspaceFileDirty: boolean;
  actionGuard: {
    isCurrentAction: (actionId: number) => boolean;
    nextActionId: () => number;
  };
  state: {
    setWorkspaceExplorerEntries: Dispatch<SetStateAction<WorkspaceFileEntry[]>>;
    setWorkspaceExplorerError: (message: string) => void;
    setWorkspaceExplorerNotice: (message: string) => void;
    setWorkspaceExplorerOpen: (open: boolean) => void;
    setWorkspaceExplorerPath: (path: string) => void;
  };
}

export function createWorkspaceExplorerNavigation({
  actionGuard,
  mutators,
  onError,
  runWorkspaceExplorerAction,
  state,
  workspace,
  workspaceFileDirty,
}: CreateWorkspaceExplorerNavigationInput) {
  async function loadWorkspaceDirectory({
    path,
    notice = '',
    openExplorer = true,
    preserveEditor = false,
  }: {
    path: string;
    notice?: string;
    openExplorer?: boolean;
    preserveEditor?: boolean;
  }) {
    if (
      !requireWorkspaceSelection({
        workspace,
        errorKind: 'workspace-file-open',
        errorMessage: 'Select a workspace before browsing files.',
        onError,
      })
    ) {
      return false;
    }

    return runWorkspaceExplorerAction(
      actionId =>
        openWorkspaceDirectory({
          workspace,
          actionId,
          path,
          notice,
          openExplorer,
          preserveEditor,
          isCurrentAction: actionGuard.isCurrentAction,
          mutators,
        }),
      { notice, errorKind: 'workspace-file-open' },
    );
  }

  async function handleWorkspaceExplorerOpen() {
    if (
      !requireWorkspaceSelection({
        workspace,
        errorKind: 'workspace-file-open',
        errorMessage: 'Select a workspace before browsing files.',
        onError,
      })
    ) {
      return false;
    }

    mutators.clearWorkspaceEditor();
    state.setWorkspaceExplorerEntries([]);
    state.setWorkspaceExplorerPath('');

    await runWorkspaceExplorerAction(
      actionId =>
        openWorkspaceDirectory({
          workspace,
          actionId,
          path: '',
          isCurrentAction: actionGuard.isCurrentAction,
          mutators,
        }),
      { openExplorer: true, errorKind: 'workspace-file-open' },
    );

    return true;
  }

  async function handleWorkspaceExplorerClose() {
    if (!confirmDiscardWorkspaceChanges({ workspaceFileDirty })) {
      return false;
    }

    actionGuard.nextActionId();
    state.setWorkspaceExplorerOpen(false);
    state.setWorkspaceExplorerError('');
    state.setWorkspaceExplorerNotice('');
    return true;
  }

  async function handleWorkspaceExplorerNavigate(path: string) {
    if (!confirmDiscardWorkspaceChanges({ workspaceFileDirty })) {
      return false;
    }

    return loadWorkspaceDirectory({ path });
  }

  async function handleWorkspaceFileOpen(path: string) {
    if (!confirmDiscardWorkspaceChanges({ workspaceFileDirty })) {
      return false;
    }

    if (
      !requireWorkspaceSelection({
        workspace,
        errorKind: 'workspace-file-open',
        errorMessage: 'Select a workspace before opening files.',
        onError,
      })
    ) {
      return false;
    }

    return runWorkspaceExplorerAction(
      actionId =>
        openWorkspaceFile({
          workspace,
          path,
          actionId,
          isCurrentAction: actionGuard.isCurrentAction,
          mutators,
        }),
      { errorKind: 'workspace-file-open' },
    );
  }

  return {
    handleWorkspaceExplorerClose,
    handleWorkspaceExplorerNavigate,
    handleWorkspaceExplorerOpen,
    handleWorkspaceFileOpen,
    loadWorkspaceDirectory,
  };
}
