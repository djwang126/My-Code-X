import type { Dispatch, SetStateAction } from 'react';

import type { WorkspaceFileDetail, WorkspaceFileEntry, WorkspaceTextFile } from '../public-types';
import { postWorkspaceFileSave } from '../api/workspace-file-api';

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

type SaveWorkspaceExplorerFileInput = {
  workspace: string;
  activeFile: WorkspaceTextFile;
  nextDraft: string;
  isCurrentAction: (actionId: number) => boolean;
  runWorkspaceExplorerAction: RunWorkspaceExplorerAction;
  setWorkspaceFileDetail: Dispatch<SetStateAction<WorkspaceFileDetail | null>>;
  setWorkspaceExplorerNotice: (notice: string) => void;
  setWorkspaceExplorerEntries: Dispatch<SetStateAction<WorkspaceFileEntry[]>>;
};

export function saveWorkspaceExplorerFile({
  workspace,
  activeFile,
  nextDraft,
  isCurrentAction,
  runWorkspaceExplorerAction,
  setWorkspaceFileDetail,
  setWorkspaceExplorerNotice,
  setWorkspaceExplorerEntries,
}: SaveWorkspaceExplorerFileInput) {
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
        current?.kind === 'text' && current.path === activeFile.path
          ? {
              ...current,
              content: nextDraft,
              size: result.size,
              truncated: false,
            }
          : current,
      );
      setWorkspaceExplorerNotice(`Saved ${activeFile.name}`);
      setWorkspaceExplorerEntries(current =>
        current.map(entry => (entry.kind === 'file' && entry.path === activeFile.path ? { ...entry, size: result.size } : entry)),
      );
      return true;
    },
    { loading: false, saving: true, errorKind: 'workspace-file-save' },
  );
}
