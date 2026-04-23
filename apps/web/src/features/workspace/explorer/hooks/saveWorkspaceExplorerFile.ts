import type { Dispatch, SetStateAction } from 'react';

import type { WorkspaceFileDetail, WorkspaceFileEntry } from '../public-types';
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
  activeFile: Extract<WorkspaceFileDetail, { kind: 'editable' }>['file'];
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
