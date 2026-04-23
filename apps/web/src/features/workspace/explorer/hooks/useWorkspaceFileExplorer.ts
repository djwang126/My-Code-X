import { createWorkspaceExplorerActionRunner } from './createWorkspaceExplorerActionRunner';
import { createWorkspaceExplorerNavigation } from './createWorkspaceExplorerNavigation';
import { createWorkspaceFileLinkActions } from './createWorkspaceFileLinkActions';
import { createWorkspaceTextFileActions } from './createWorkspaceTextFileActions';
import { useWorkspaceExplorerState, type WorkspaceExplorerErrorKind } from './useWorkspaceExplorerState';

type UseWorkspaceFileExplorerOptions = {
  workspace: string;
  onError: (message: string, kind?: WorkspaceExplorerErrorKind) => boolean;
};

export function useWorkspaceFileExplorer({ workspace, onError }: UseWorkspaceFileExplorerOptions) {
  const explorerState = useWorkspaceExplorerState({ workspace });
  const { actionGuard, mutators } = explorerState;

  const runWorkspaceExplorerAction = createWorkspaceExplorerActionRunner({
    actionGuard,
    onError,
    setWorkspaceExplorerOpen: explorerState.setWorkspaceExplorerOpen,
    setWorkspaceExplorerLoading: explorerState.setWorkspaceExplorerLoading,
    setWorkspaceExplorerError: explorerState.setWorkspaceExplorerError,
    setWorkspaceExplorerNotice: explorerState.setWorkspaceExplorerNotice,
    setWorkspaceFileSaving: explorerState.setWorkspaceFileSaving,
  });

  const navigation = createWorkspaceExplorerNavigation({
    actionGuard,
    mutators,
    onError,
    runWorkspaceExplorerAction,
    state: {
      setWorkspaceExplorerEntries: explorerState.setWorkspaceExplorerEntries,
      setWorkspaceExplorerError: explorerState.setWorkspaceExplorerError,
      setWorkspaceExplorerNotice: explorerState.setWorkspaceExplorerNotice,
      setWorkspaceExplorerOpen: explorerState.setWorkspaceExplorerOpen,
      setWorkspaceExplorerPath: explorerState.setWorkspaceExplorerPath,
    },
    workspace,
    workspaceFileDirty: explorerState.workspaceFileDirty,
  });

  const textFileActions = createWorkspaceTextFileActions({
    actionGuard,
    runWorkspaceExplorerAction,
    setWorkspaceExplorerEntries: explorerState.setWorkspaceExplorerEntries,
    setWorkspaceExplorerNotice: explorerState.setWorkspaceExplorerNotice,
    setWorkspaceFileDetail: explorerState.setWorkspaceFileDetail,
    setWorkspaceFileDraft: explorerState.setWorkspaceFileDraft,
    state: {
      workspaceFileDetail: explorerState.workspaceFileDetail,
      workspaceFileDraft: explorerState.workspaceFileDraft,
    },
    workspace,
  });

  const fileLinkActions = createWorkspaceFileLinkActions({
    actionGuard,
    mutators,
    onError,
    runWorkspaceExplorerAction,
    workspace,
    workspaceFileDirty: explorerState.workspaceFileDirty,
  });

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
    handleWorkspaceExplorerOpen: navigation.handleWorkspaceExplorerOpen,
    handleWorkspaceExplorerClose: navigation.handleWorkspaceExplorerClose,
    handleWorkspaceExplorerNavigate: navigation.handleWorkspaceExplorerNavigate,
    handleWorkspaceFileOpen: navigation.handleWorkspaceFileOpen,
    handleWorkspaceTextEditStart: textFileActions.handleWorkspaceTextEditStart,
    handleWorkspaceFileSave: textFileActions.handleWorkspaceFileSave,
    handleWorkspaceFileLinkOpen: fileLinkActions.handleWorkspaceFileLinkOpen,
    isWorkspaceFileLink: fileLinkActions.isWorkspaceFileLink,
  };
}
