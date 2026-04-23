import { resolveWorkspaceRelativePathFromFileHref } from '../lib/workspace-file-paths';
import type { WorkspaceExplorerErrorKind } from './useWorkspaceExplorerState';

type RequireWorkspaceInput = {
  workspace: string;
  errorKind: WorkspaceExplorerErrorKind;
  errorMessage: string;
  onError: (message: string, kind?: WorkspaceExplorerErrorKind) => boolean;
};

type ConfirmDiscardWorkspaceChangesInput = {
  workspaceFileDirty: boolean;
};

type IsWorkspaceFileLinkInput = {
  workspace: string;
  href: string;
};

export function requireWorkspaceSelection({
  workspace,
  errorKind,
  errorMessage,
  onError,
}: RequireWorkspaceInput) {
  return workspace.trim() ? true : onError(errorMessage, errorKind);
}

export function confirmDiscardWorkspaceChanges({
  workspaceFileDirty,
}: ConfirmDiscardWorkspaceChangesInput) {
  return !workspaceFileDirty || window.confirm('You have unsaved file changes. Discard them?');
}

export function isWorkspaceFileLinkForWorkspace({ workspace, href }: IsWorkspaceFileLinkInput) {
  if (!workspace.trim()) {
    return false;
  }

  return resolveWorkspaceRelativePathFromFileHref({ href, workspace }) !== null;
}
