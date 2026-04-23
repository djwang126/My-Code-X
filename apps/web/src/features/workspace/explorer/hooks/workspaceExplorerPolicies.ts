import { resolveWorkspaceRelativePathFromFileHref } from '../lib/workspace-file-paths';
import type { WorkspaceExplorerErrorKind } from './useWorkspaceExplorerState';

interface RequireWorkspaceSelectionInput {
  workspace: string;
  errorKind: WorkspaceExplorerErrorKind;
  errorMessage: string;
  onError: (message: string, kind?: WorkspaceExplorerErrorKind) => boolean;
}

interface ConfirmDiscardWorkspaceChangesInput {
  workspaceFileDirty: boolean;
}

interface IsWorkspaceFileLinkInput {
  workspace: string;
  href: string;
}

export function requireWorkspaceSelection({
  workspace,
  errorKind,
  errorMessage,
  onError,
}: RequireWorkspaceSelectionInput) {
  return workspace.trim() ? true : onError(errorMessage, errorKind);
}

export function confirmDiscardWorkspaceChanges({
  workspaceFileDirty,
}: ConfirmDiscardWorkspaceChangesInput) {
  return !workspaceFileDirty || window.confirm('You have unsaved file changes. Discard them?');
}

export function isWorkspaceFileLinkForWorkspace({
  workspace,
  href,
}: IsWorkspaceFileLinkInput) {
  if (!workspace.trim()) {
    return false;
  }

  return resolveWorkspaceRelativePathFromFileHref({ href, workspace }) !== null;
}
