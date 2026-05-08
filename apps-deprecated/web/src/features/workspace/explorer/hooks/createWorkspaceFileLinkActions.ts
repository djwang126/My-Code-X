import { fetchWorkspaceFiles } from '../api/workspace-file-api';
import { WorkspaceOutsideCurrentWorkspaceError, WorkspacePathNotFoundError } from '../errors/workspace-explorer-errors';
import { applyDirectoryState, openWorkspaceDirectory, openWorkspaceFileWithEntries } from '../lib/workspace-file-explorer-helpers';
import { getParentRelativePath, resolveWorkspaceRelativePathFromFileHref } from '../lib/workspace-file-paths';
import type { RunWorkspaceExplorerAction } from './createWorkspaceExplorerActionRunner';
import { confirmDiscardWorkspaceChanges, isWorkspaceFileLinkForWorkspace, requireWorkspaceSelection } from './workspaceExplorerPolicies';
import type { WorkspaceExplorerMutators } from './useWorkspaceExplorerState';

interface CreateWorkspaceFileLinkActionsInput {
  actionGuard: {
    isCurrentAction: (actionId: number) => boolean;
  };
  mutators: WorkspaceExplorerMutators;
  onError: (message: string, kind?: 'workspace-file-open' | 'workspace-file-save') => boolean;
  runWorkspaceExplorerAction: RunWorkspaceExplorerAction;
  workspace: string;
  workspaceFileDirty: boolean;
}

export function createWorkspaceFileLinkActions({
  actionGuard,
  mutators,
  onError,
  runWorkspaceExplorerAction,
  workspace,
  workspaceFileDirty,
}: CreateWorkspaceFileLinkActionsInput) {
  async function handleWorkspaceFileLinkOpen(href: string) {
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

    const relativePath = resolveWorkspaceRelativePathFromFileHref({ href, workspace });
    if (relativePath === null) {
      return onError(new WorkspaceOutsideCurrentWorkspaceError().message, 'workspace-file-open');
    }

    if (!confirmDiscardWorkspaceChanges({ workspaceFileDirty })) {
      return false;
    }

    return runWorkspaceExplorerAction(async actionId => {
      if (!relativePath) {
        return openWorkspaceDirectory({
          workspace,
          actionId,
          path: '',
          isCurrentAction: actionGuard.isCurrentAction,
          mutators,
        });
      }

      const parentPath = getParentRelativePath(relativePath);
      const parentEntries = await fetchWorkspaceFiles({ workspace, path: parentPath });
      if (!actionGuard.isCurrentAction(actionId)) {
        return false;
      }

      const targetEntry = parentEntries.find(entry => entry.path === relativePath);
      if (!targetEntry) {
        throw new WorkspacePathNotFoundError({ path: relativePath });
      }

      if (targetEntry.kind === 'directory') {
        return openWorkspaceDirectory({
          workspace,
          actionId,
          path: relativePath,
          isCurrentAction: actionGuard.isCurrentAction,
          mutators,
        });
      }

      if (
        !applyDirectoryState({
          actionId,
          entries: parentEntries,
          path: parentPath,
          preserveEditor: true,
          isCurrentAction: actionGuard.isCurrentAction,
          mutators,
        })
      ) {
        return false;
      }

      return openWorkspaceFileWithEntries({
        workspace,
        actionId,
        path: relativePath,
        entries: parentEntries,
        isCurrentAction: actionGuard.isCurrentAction,
        mutators,
      });
    }, { openExplorer: true, errorKind: 'workspace-file-open' });
  }

  function isWorkspaceFileLink(href: string) {
    return isWorkspaceFileLinkForWorkspace({ href, workspace });
  }

  return {
    handleWorkspaceFileLinkOpen,
    isWorkspaceFileLink,
  };
}
