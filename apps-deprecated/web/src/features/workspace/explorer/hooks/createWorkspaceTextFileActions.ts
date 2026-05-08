import type { WorkspaceFileDetail } from '../public-types';
import { isTextDetail, loadFullWorkspaceTextFile } from '../lib/workspace-file-explorer-helpers';
import { saveWorkspaceExplorerFile } from './saveWorkspaceExplorerFile';
import type { RunWorkspaceExplorerAction } from './createWorkspaceExplorerActionRunner';
import type { WorkspaceExplorerMutators } from './useWorkspaceExplorerState';

interface CreateWorkspaceTextFileActionsInput {
  actionGuard: {
    isCurrentAction: (actionId: number) => boolean;
  };
  runWorkspaceExplorerAction: RunWorkspaceExplorerAction;
  setWorkspaceExplorerEntries: WorkspaceExplorerMutators['setWorkspaceExplorerEntries'];
  setWorkspaceExplorerNotice: (notice: string) => void;
  setWorkspaceFileDetail: WorkspaceExplorerMutators['setWorkspaceFileDetail'];
  setWorkspaceFileDraft: (draft: string) => void;
  state: {
    workspaceFileDetail: WorkspaceFileDetail | null;
    workspaceFileDraft: string;
  };
  workspace: string;
}

export function createWorkspaceTextFileActions({
  actionGuard,
  runWorkspaceExplorerAction,
  setWorkspaceExplorerEntries,
  setWorkspaceExplorerNotice,
  setWorkspaceFileDetail,
  setWorkspaceFileDraft,
  state,
  workspace,
}: CreateWorkspaceTextFileActionsInput) {
  async function handleWorkspaceTextEditStart() {
    if (!isTextDetail(state.workspaceFileDetail)) {
      return false;
    }

    const activeFile = state.workspaceFileDetail;
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

        setWorkspaceFileDetail(detail);
        setWorkspaceFileDraft(detail.content);
        setWorkspaceExplorerNotice(`Loaded full ${detail.name}`);
        return true;
      },
      { errorKind: 'workspace-file-open' },
    );
  }

  async function handleWorkspaceFileSave() {
    if (!isTextDetail(state.workspaceFileDetail)) {
      return false;
    }

    return saveWorkspaceExplorerFile({
      workspace,
      activeFile: state.workspaceFileDetail,
      nextDraft: state.workspaceFileDraft,
      isCurrentAction: actionGuard.isCurrentAction,
      runWorkspaceExplorerAction,
      setWorkspaceFileDetail,
      setWorkspaceExplorerNotice,
      setWorkspaceExplorerEntries,
    });
  }

  return {
    handleWorkspaceFileSave,
    handleWorkspaceTextEditStart,
  };
}
