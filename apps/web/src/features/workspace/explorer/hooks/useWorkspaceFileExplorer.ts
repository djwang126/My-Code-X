import { fetchWorkspaceFiles } from '../api/workspace-file-api';
import { WorkspaceOutsideCurrentWorkspaceError, WorkspacePathNotFoundError } from '../errors/workspace-explorer-errors';
import {
  applyDirectoryState,
  isTextDetail,
  loadFullWorkspaceTextFile,
  openWorkspaceDirectory,
  openWorkspaceFile,
  openWorkspaceFileWithEntries,
} from '../lib/workspace-file-explorer-helpers';
import { getParentRelativePath, resolveWorkspaceRelativePathFromFileHref } from '../lib/workspace-file-paths';
import { createWorkspaceExplorerActionRunner } from './createWorkspaceExplorerActionRunner';
import { saveWorkspaceExplorerFile } from './saveWorkspaceExplorerFile';
import { useWorkspaceExplorerState, type WorkspaceExplorerErrorKind } from './useWorkspaceExplorerState';
import {
  confirmDiscardWorkspaceChanges,
  isWorkspaceFileLinkForWorkspace,
  requireWorkspaceSelection,
} from './workspaceExplorerGuards';

type UseWorkspaceFileExplorerOptions = {
  workspace: string;
  onError: (message: string, kind?: WorkspaceExplorerErrorKind) => boolean;
};

export function useWorkspaceFileExplorer({ workspace, onError }: UseWorkspaceFileExplorerOptions) {
  const explorerState = useWorkspaceExplorerState({ workspace });
  const { actionGuard, clearWorkspaceEditor, mutators } = explorerState;

  const runWorkspaceExplorerAction = createWorkspaceExplorerActionRunner({
    actionGuard,
    onError,
    setWorkspaceExplorerOpen: explorerState.setWorkspaceExplorerOpen,
    setWorkspaceExplorerLoading: explorerState.setWorkspaceExplorerLoading,
    setWorkspaceExplorerError: explorerState.setWorkspaceExplorerError,
    setWorkspaceExplorerNotice: explorerState.setWorkspaceExplorerNotice,
    setWorkspaceFileSaving: explorerState.setWorkspaceFileSaving,
  });

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

    clearWorkspaceEditor();
    explorerState.setWorkspaceExplorerEntries([]);
    explorerState.setWorkspaceExplorerPath('');

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
    if (!confirmDiscardWorkspaceChanges({ workspaceFileDirty: explorerState.workspaceFileDirty })) {
      return false;
    }

    actionGuard.nextActionId();
    explorerState.setWorkspaceExplorerOpen(false);
    explorerState.setWorkspaceExplorerError('');
    explorerState.setWorkspaceExplorerNotice('');
    return true;
  }

  async function handleWorkspaceExplorerNavigate(path: string) {
    if (!confirmDiscardWorkspaceChanges({ workspaceFileDirty: explorerState.workspaceFileDirty })) {
      return false;
    }

    return loadWorkspaceDirectory({ path });
  }

  async function handleWorkspaceFileOpen(path: string) {
    if (!confirmDiscardWorkspaceChanges({ workspaceFileDirty: explorerState.workspaceFileDirty })) {
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

  async function handleWorkspaceTextEditStart() {
    if (!isTextDetail(explorerState.workspaceFileDetail)) {
      return false;
    }

    const activeFile = explorerState.workspaceFileDetail;
    if (!activeFile.truncated) {
      return true;
    }

    return runWorkspaceExplorerAction(
      async actionId => {
        const detail = await loadFullWorkspaceTextFile({
          workspace,
          path: activeFile.path,
        });
        if (!detail || !actionGuard.isCurrentAction(actionId)) {
          return false;
        }

        explorerState.setWorkspaceFileDetail(detail);
        explorerState.setWorkspaceFileDraft(detail.content);
        explorerState.setWorkspaceExplorerNotice(`Loaded full ${detail.name}`);
        return true;
      },
      { errorKind: 'workspace-file-open' },
    );
  }

  async function handleWorkspaceFileSave() {
    if (!isTextDetail(explorerState.workspaceFileDetail)) {
      return false;
    }

    const activeFile = explorerState.workspaceFileDetail;
    return saveWorkspaceExplorerFile({
      workspace,
      activeFile,
      nextDraft: explorerState.workspaceFileDraft,
      isCurrentAction: actionGuard.isCurrentAction,
      runWorkspaceExplorerAction,
      setWorkspaceFileDetail: explorerState.setWorkspaceFileDetail,
      setWorkspaceExplorerNotice: explorerState.setWorkspaceExplorerNotice,
      setWorkspaceExplorerEntries: explorerState.setWorkspaceExplorerEntries,
    });
  }

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

    if (!confirmDiscardWorkspaceChanges({ workspaceFileDirty: explorerState.workspaceFileDirty })) {
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
    workspaceExplorerOpen: explorerState.workspaceExplorerOpen,
    workspaceExplorerLoading: explorerState.workspaceExplorerLoading,
    workspaceExplorerError: explorerState.workspaceExplorerError,
    workspaceExplorerNotice: explorerState.workspaceExplorerNotice,
    workspaceExplorerPath: explorerState.workspaceExplorerPath,
    workspaceExplorerEntries: explorerState.workspaceExplorerEntries,
    workspaceFileDetail: explorerState.workspaceFileDetail,
    workspaceFileDraft: explorerState.workspaceFileDraft,
    workspaceFileDirty: explorerState.workspaceFileDirty,
    workspaceFileSaving: explorerState.workspaceFileSaving,
    setWorkspaceFileDraft: explorerState.setWorkspaceFileDraft,
    handleWorkspaceExplorerOpen,
    handleWorkspaceExplorerClose,
    handleWorkspaceExplorerNavigate,
    handleWorkspaceFileOpen,
    handleWorkspaceTextEditStart,
    handleWorkspaceFileSave,
    handleWorkspaceFileLinkOpen,
    isWorkspaceFileLink,
  };
}
