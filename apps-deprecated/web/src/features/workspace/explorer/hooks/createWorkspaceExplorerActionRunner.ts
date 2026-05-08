import type { WorkspaceExplorerActionGuard, WorkspaceExplorerErrorKind } from './useWorkspaceExplorerState';

export type WorkspaceExplorerAction = (actionId: number) => Promise<boolean>;

export type RunWorkspaceExplorerActionOptions = {
  loading?: boolean;
  clearError?: boolean;
  notice?: string;
  saving?: boolean;
  openExplorer?: boolean;
  errorKind?: WorkspaceExplorerErrorKind;
};

type CreateWorkspaceExplorerActionRunnerInput = {
  actionGuard: WorkspaceExplorerActionGuard;
  onError: (message: string, kind?: WorkspaceExplorerErrorKind) => boolean;
  setWorkspaceExplorerOpen: (open: boolean) => void;
  setWorkspaceExplorerLoading: (loading: boolean) => void;
  setWorkspaceExplorerError: (message: string) => void;
  setWorkspaceExplorerNotice: (message: string) => void;
  setWorkspaceFileSaving: (saving: boolean) => void;
};

export function createWorkspaceExplorerActionRunner({
  actionGuard,
  onError,
  setWorkspaceExplorerOpen,
  setWorkspaceExplorerLoading,
  setWorkspaceExplorerError,
  setWorkspaceExplorerNotice,
  setWorkspaceFileSaving,
}: CreateWorkspaceExplorerActionRunnerInput) {
  return async function runWorkspaceExplorerAction(
    action: WorkspaceExplorerAction,
    {
      loading = true,
      clearError = true,
      notice = '',
      saving = false,
      openExplorer = false,
      errorKind = 'workspace-file-open',
    }: RunWorkspaceExplorerActionOptions = {},
  ) {
    const actionId = actionGuard.nextActionId();

    if (openExplorer) {
      setWorkspaceExplorerOpen(true);
    }

    if (loading) {
      setWorkspaceExplorerLoading(true);
    }

    if (saving) {
      setWorkspaceFileSaving(true);
    }

    if (clearError) {
      setWorkspaceExplorerError('');
    }

    setWorkspaceExplorerNotice(notice);

    try {
      return await action(actionId);
    } catch (error) {
      if (actionGuard.isCurrentAction(actionId)) {
        const message = error instanceof Error ? error.message : String(error);
        setWorkspaceExplorerError(message);
        onError(message, errorKind);
      }
      return false;
    } finally {
      if (loading && actionGuard.isCurrentAction(actionId)) {
        setWorkspaceExplorerLoading(false);
      }

      if (saving && actionGuard.isCurrentAction(actionId)) {
        setWorkspaceFileSaving(false);
      }
    }
  };
}

export type RunWorkspaceExplorerAction = ReturnType<typeof createWorkspaceExplorerActionRunner>;
