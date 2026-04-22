import { useEffect, useRef, useState } from 'react';

import type { WorkspaceFileDetail, WorkspaceFileEntry } from '../public-types';
import { fetchWorkspaceFiles, postWorkspaceFileSave } from '../api/workspace-file-api';
import {
  applyDirectoryState,
  createReadOnlyDetailFromEntry,
  isEditableDetail,
  openWorkspaceDirectory,
  openWorkspaceFile,
  openWorkspaceFileWithEntries,
} from '../lib/workspace-file-explorer-helpers';
import { getParentRelativePath, resolveWorkspaceRelativePathFromFileHref } from '../lib/workspace-file-paths';

type WorkspaceExplorerErrorKind = 'workspace-file-open' | 'workspace-file-save';

type UseWorkspaceFileExplorerOptions = {
  workspace: string;
  onError: (message: string, kind?: WorkspaceExplorerErrorKind) => boolean;
};

export function useWorkspaceFileExplorer({ workspace, onError }: UseWorkspaceFileExplorerOptions) {
  const [workspaceExplorerOpen, setWorkspaceExplorerOpen] = useState(false);
  const [workspaceExplorerLoading, setWorkspaceExplorerLoading] = useState(false);
  const [workspaceExplorerError, setWorkspaceExplorerError] = useState('');
  const [workspaceExplorerNotice, setWorkspaceExplorerNotice] = useState('');
  const [workspaceExplorerPath, setWorkspaceExplorerPath] = useState('');
  const [workspaceExplorerEntries, setWorkspaceExplorerEntries] = useState<WorkspaceFileEntry[]>([]);
  const [workspaceFileDetail, setWorkspaceFileDetail] = useState<WorkspaceFileDetail | null>(null);
  const [workspaceFileDraft, setWorkspaceFileDraft] = useState('');
  const [workspaceFileSaving, setWorkspaceFileSaving] = useState(false);
  const latestActionIdRef = useRef(0);

  const workspaceFileDirty = isEditableDetail(workspaceFileDetail)
    ? workspaceFileDraft !== workspaceFileDetail.file.content
    : false;

  const mutators = {
    setWorkspaceExplorerEntries,
    setWorkspaceExplorerPath,
    setWorkspaceExplorerOpen,
    setWorkspaceExplorerNotice,
    setWorkspaceFileDetail,
    setWorkspaceFileDraft,
    clearWorkspaceEditor,
  };

  function nextActionId() {
    latestActionIdRef.current += 1;
    return latestActionIdRef.current;
  }

  function isCurrentAction(actionId: number) {
    return latestActionIdRef.current === actionId;
  }

  useEffect(() => {
    latestActionIdRef.current += 1;
    setWorkspaceExplorerOpen(false);
    setWorkspaceExplorerLoading(false);
    setWorkspaceExplorerError('');
    setWorkspaceExplorerNotice('');
    setWorkspaceExplorerPath('');
    setWorkspaceExplorerEntries([]);
    setWorkspaceFileDetail(null);
    setWorkspaceFileDraft('');
    setWorkspaceFileSaving(false);
  }, [workspace]);

  function requireWorkspace(kind: WorkspaceExplorerErrorKind, errorMessage: string) {
    return workspace.trim() ? true : onError(errorMessage, kind);
  }

  function confirmDiscardWorkspaceChanges() {
    return !workspaceFileDirty || window.confirm('You have unsaved file changes. Discard them?');
  }

  function clearWorkspaceEditor() {
    setWorkspaceFileDetail(null);
    setWorkspaceFileDraft('');
  }

  async function runWorkspaceExplorerAction(
    action: (actionId: number) => Promise<boolean>,
    {
      loading = true,
      clearError = true,
      notice = '',
      saving = false,
      openExplorer = false,
      errorKind = 'workspace-file-open',
    }: {
      loading?: boolean;
      clearError?: boolean;
      notice?: string;
      saving?: boolean;
      openExplorer?: boolean;
      errorKind?: WorkspaceExplorerErrorKind;
    } = {},
  ) {
    const actionId = nextActionId();
    if (openExplorer) setWorkspaceExplorerOpen(true);
    if (loading) setWorkspaceExplorerLoading(true);
    if (saving) setWorkspaceFileSaving(true);
    if (clearError) setWorkspaceExplorerError('');
    setWorkspaceExplorerNotice(notice);

    try {
      return await action(actionId);
    } catch (error) {
      if (isCurrentAction(actionId)) {
        const message = error instanceof Error ? error.message : String(error);
        setWorkspaceExplorerError(message);
        onError(message, errorKind);
      }
      return false;
    } finally {
      if (loading && isCurrentAction(actionId)) setWorkspaceExplorerLoading(false);
      if (saving && isCurrentAction(actionId)) setWorkspaceFileSaving(false);
    }
  }

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
    if (!requireWorkspace('workspace-file-open', 'Select a workspace before browsing files.')) {
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
          isCurrentAction,
          mutators,
        }),
      { notice, errorKind: 'workspace-file-open' },
    );
  }

  async function handleWorkspaceExplorerOpen() {
    if (!requireWorkspace('workspace-file-open', 'Select a workspace before browsing files.')) {
      return false;
    }

    clearWorkspaceEditor();
    setWorkspaceExplorerEntries([]);
    setWorkspaceExplorerPath('');
    await runWorkspaceExplorerAction(
      actionId => openWorkspaceDirectory({ workspace, actionId, path: '', isCurrentAction, mutators }),
      { openExplorer: true, errorKind: 'workspace-file-open' },
    );
    return true;
  }

  async function handleWorkspaceExplorerClose() {
    if (!confirmDiscardWorkspaceChanges()) {
      return false;
    }

    nextActionId();
    setWorkspaceExplorerOpen(false);
    setWorkspaceExplorerError('');
    setWorkspaceExplorerNotice('');
    return true;
  }

  async function handleWorkspaceExplorerNavigate(path: string) {
    if (!confirmDiscardWorkspaceChanges()) {
      return false;
    }

    return loadWorkspaceDirectory({ path });
  }

  async function handleWorkspaceFileOpen(path: string) {
    if (!confirmDiscardWorkspaceChanges()) {
      return false;
    }

    if (!requireWorkspace('workspace-file-open', 'Select a workspace before opening files.')) {
      return false;
    }

    return runWorkspaceExplorerAction(async actionId => {
      try {
        return await openWorkspaceFile({ workspace, path, actionId, isCurrentAction, mutators });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message !== 'not_text_editable') {
          throw error;
        }

        const parentPath = getParentRelativePath(path);
        const entries = await fetchWorkspaceFiles({ workspace, path: parentPath });
        if (!isCurrentAction(actionId)) {
          return false;
        }

        setWorkspaceExplorerEntries(entries);
        setWorkspaceExplorerPath(parentPath);
        setWorkspaceExplorerOpen(true);
        setWorkspaceExplorerNotice('');
        setWorkspaceFileDetail(createReadOnlyDetailFromEntry(path, entries.find(entry => entry.path === path)));
        setWorkspaceFileDraft('');
        return true;
      }
    }, { errorKind: 'workspace-file-open' });
  }

  async function handleWorkspaceFileSave() {
    if (!isEditableDetail(workspaceFileDetail)) {
      return false;
    }

    const activeFile = workspaceFileDetail.file;
    const nextDraft = workspaceFileDraft;
    return runWorkspaceExplorerAction(
      async actionId => {
        const result = await postWorkspaceFileSave({
          workspace,
          path: activeFile.path,
          content: nextDraft,
        });
        if (!isCurrentAction(actionId)) {
          return false;
        }

        setWorkspaceFileDetail(current =>
          current?.kind === 'editable' && current.file.path === activeFile.path
            ? {
                kind: 'editable',
                file: {
                  ...current.file,
                  content: nextDraft,
                  size: result.size,
                },
              }
            : current,
        );
        setWorkspaceExplorerNotice(`Saved ${activeFile.name}`);
        setWorkspaceExplorerEntries(current =>
          current.map(entry => (entry.path === activeFile.path ? { ...entry, size: result.size } : entry)),
        );
        return true;
      },
      { loading: false, saving: true, errorKind: 'workspace-file-save' },
    );
  }

  async function handleWorkspaceFileLinkOpen(href: string) {
    if (!requireWorkspace('workspace-file-open', 'Select a workspace before opening files.')) {
      return false;
    }

    const relativePath = resolveWorkspaceRelativePathFromFileHref({ href, workspace });
    if (relativePath === null) {
      return onError('The selected file is outside the current workspace.', 'workspace-file-open');
    }

    if (!confirmDiscardWorkspaceChanges()) {
      return false;
    }

    return runWorkspaceExplorerAction(async actionId => {
      if (!relativePath) {
        return openWorkspaceDirectory({ workspace, actionId, path: '', isCurrentAction, mutators });
      }

      const parentPath = getParentRelativePath(relativePath);
      const parentEntries = await fetchWorkspaceFiles({ workspace, path: parentPath });
      if (!isCurrentAction(actionId)) {
        return false;
      }

      const targetEntry = parentEntries.find(entry => entry.path === relativePath);
      if (!targetEntry) {
        throw new Error('not_found');
      }

      if (targetEntry.kind === 'directory') {
        return openWorkspaceDirectory({
          workspace,
          actionId,
          path: relativePath,
          isCurrentAction,
          mutators,
        });
      }

      try {
        return await openWorkspaceFileWithEntries({
          workspace,
          actionId,
          path: relativePath,
          entries: parentEntries,
          isCurrentAction,
          mutators,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message !== 'not_text_editable') {
          throw error;
        }

        if (!applyDirectoryState({
          actionId,
          entries: parentEntries,
          path: parentPath,
          preserveEditor: true,
          isCurrentAction,
          mutators,
        })) {
          return false;
        }

        setWorkspaceFileDetail(createReadOnlyDetailFromEntry(relativePath, targetEntry));
        setWorkspaceFileDraft('');
        setWorkspaceExplorerNotice('');
        return true;
      }
    }, { openExplorer: true, errorKind: 'workspace-file-open' });
  }

  function isWorkspaceFileLink(href: string) {
    if (!workspace.trim()) {
      return false;
    }

    return resolveWorkspaceRelativePathFromFileHref({ href, workspace }) !== null;
  }

  return {
    workspaceExplorerOpen,
    workspaceExplorerLoading,
    workspaceExplorerError,
    workspaceExplorerNotice,
    workspaceExplorerPath,
    workspaceExplorerEntries,
    workspaceFileDetail,
    workspaceFileDraft,
    workspaceFileDirty,
    workspaceFileSaving,
    setWorkspaceFileDraft,
    handleWorkspaceExplorerOpen,
    handleWorkspaceExplorerClose,
    handleWorkspaceExplorerNavigate,
    handleWorkspaceFileOpen,
    handleWorkspaceFileSave,
    handleWorkspaceFileLinkOpen,
    isWorkspaceFileLink,
  };
}
