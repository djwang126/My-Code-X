import type { Dispatch, SetStateAction } from 'react';

import type { WorkspaceFileDetail, WorkspaceFileEntry } from '../public-types';
import { fetchWorkspaceFiles } from '../api/workspace-file-api';
import { WorkspaceFileNotTextEditableError } from '../errors/workspace-explorer-errors';
import { createReadOnlyDetailFromEntry, openWorkspaceFile } from '../lib/workspace-file-explorer-helpers';
import { getParentRelativePath } from '../lib/workspace-file-paths';
import type { WorkspaceExplorerMutators } from './useWorkspaceExplorerState';

type RunWorkspaceExplorerAction = (
  action: (actionId: number) => Promise<boolean>,
  options?: {
    loading?: boolean;
    clearError?: boolean;
    notice?: string;
    saving?: boolean;
    openExplorer?: boolean;
    errorKind?: 'workspace-file-open' | 'workspace-file-save';
  },
) => Promise<boolean>;

type OpenWorkspaceFileWithReadOnlyFallbackInput = {
  workspace: string;
  path: string;
  isCurrentAction: (actionId: number) => boolean;
  mutators: WorkspaceExplorerMutators;
  runWorkspaceExplorerAction: RunWorkspaceExplorerAction;
  setWorkspaceExplorerEntries: Dispatch<SetStateAction<WorkspaceFileEntry[]>>;
  setWorkspaceExplorerPath: (path: string) => void;
  setWorkspaceExplorerOpen: (open: boolean) => void;
  setWorkspaceExplorerNotice: (notice: string) => void;
  setWorkspaceFileDetail: Dispatch<SetStateAction<WorkspaceFileDetail | null>>;
  setWorkspaceFileDraft: (draft: string) => void;
};

export function openWorkspaceFileWithReadOnlyFallback({
  workspace,
  path,
  isCurrentAction,
  mutators,
  runWorkspaceExplorerAction,
  setWorkspaceExplorerEntries,
  setWorkspaceExplorerPath,
  setWorkspaceExplorerOpen,
  setWorkspaceExplorerNotice,
  setWorkspaceFileDetail,
  setWorkspaceFileDraft,
}: OpenWorkspaceFileWithReadOnlyFallbackInput) {
  return runWorkspaceExplorerAction(async actionId => {
    try {
      return await openWorkspaceFile({
        workspace,
        path,
        actionId,
        isCurrentAction,
        mutators,
      });
    } catch (error) {
      if (!(error instanceof WorkspaceFileNotTextEditableError)) {
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
