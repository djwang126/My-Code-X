import { clearLocalStorageValue, persistLocalStorageValue, readLocalStorageValue } from '../../../shared/lib/browser-storage';
import { normalizeWorkspacePath } from '../../../shared/lib/workspace-path';

const savedWorkspacesStorageKey = 'my-code-x-saved-workspaces';

export type SavedWorkspace = {
  path: string;
  label: string;
  lastThreadId: string;
};

function findSavedWorkspace(path: string, workspaces = readSavedWorkspaces()) {
  const normalizedPath = normalizeWorkspacePath(path);

  if (!normalizedPath) {
    return null;
  }

  return workspaces.find(workspace => workspace.path === normalizedPath) ?? null;
}

function readSavedWorkspaces(): SavedWorkspace[] {
  const raw = readLocalStorageValue(savedWorkspacesStorageKey);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(entry => {
        const path = normalizeWorkspacePath(entry?.path);

        if (!path) {
          return null;
        }

        return {
          path,
          label: String(entry?.label || path),
          lastThreadId: String(entry?.lastThreadId || ''),
        };
      })
      .filter((entry): entry is SavedWorkspace => entry !== null);
  } catch {
    return [];
  }
}

function persistSavedWorkspaces(workspaces: SavedWorkspace[]) {
  if (!workspaces.length) {
    clearLocalStorageValue(savedWorkspacesStorageKey);
    return;
  }

  persistLocalStorageValue(savedWorkspacesStorageKey, JSON.stringify(workspaces));
}

function updateSavedWorkspaces(updater: (workspaces: SavedWorkspace[]) => SavedWorkspace[]) {
  const nextWorkspaces = updater(readSavedWorkspaces());
  persistSavedWorkspaces(nextWorkspaces);
  return nextWorkspaces;
}

export function listSavedWorkspaces(): SavedWorkspace[] {
  return readSavedWorkspaces();
}

export function saveWorkspace({
  path,
  label,
}: {
  path: string;
  label?: string;
}): SavedWorkspace {
  const normalizedPath = normalizeWorkspacePath(path);

  if (!normalizedPath) {
    throw new Error('workspace path is required');
  }

  const nextWorkspace: SavedWorkspace = {
    path: normalizedPath,
    label: String(label || normalizedPath).trim() || normalizedPath,
    lastThreadId: '',
  };

  const nextWorkspaces = updateSavedWorkspaces(workspaces =>
    findSavedWorkspace(normalizedPath, workspaces)
      ? workspaces.map(workspace =>
          workspace.path === normalizedPath ? { ...workspace, label: nextWorkspace.label } : workspace,
        )
      : [...workspaces, nextWorkspace],
  );

  return findSavedWorkspace(normalizedPath, nextWorkspaces) ?? nextWorkspace;
}

export function removeSavedWorkspace(path: string) {
  const normalizedPath = normalizeWorkspacePath(path);
  updateSavedWorkspaces(workspaces => workspaces.filter(workspace => workspace.path !== normalizedPath));
}

export function rememberWorkspaceThread({
  path,
  threadId,
}: {
  path: string;
  threadId: string;
}) {
  const normalizedPath = normalizeWorkspacePath(path);

  if (!normalizedPath) {
    return;
  }

  updateSavedWorkspaces(workspaces =>
    workspaces.map(workspace =>
      workspace.path === normalizedPath ? { ...workspace, lastThreadId: String(threadId || '').trim() } : workspace,
    ),
  );
}
