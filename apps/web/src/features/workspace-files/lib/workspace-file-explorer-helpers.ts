import type { WorkspaceFile, WorkspaceFileDetail, WorkspaceFileEntry } from '../public-types';
import { fetchWorkspaceFile, fetchWorkspaceFiles } from '../api/workspace-file-api';
import { getParentRelativePath } from './workspace-file-paths';

type WorkspaceExplorerMutators = {
  setWorkspaceExplorerEntries: (entries: WorkspaceFileEntry[]) => void;
  setWorkspaceExplorerPath: (path: string) => void;
  setWorkspaceExplorerOpen: (open: boolean) => void;
  setWorkspaceExplorerNotice: (notice: string) => void;
  setWorkspaceFileDetail: (detail: WorkspaceFileDetail | null) => void;
  setWorkspaceFileDraft: (draft: string) => void;
  clearWorkspaceEditor: () => void;
};

function createReadOnlyWorkspaceFileDetail({
  path,
  name,
  size = 0,
}: {
  path: string;
  name?: string;
  size?: number;
}): WorkspaceFileDetail {
  const segments = path.split(/[\\/]/).filter(Boolean);
  const resolvedName = name || segments[segments.length - 1] || path;

  return {
    kind: 'readOnly',
    path,
    name: resolvedName,
    size,
  };
}

function createEditableWorkspaceFileDetail(file: WorkspaceFile): WorkspaceFileDetail {
  return {
    kind: 'editable',
    file: {
      ...file,
      isTextEditable: true,
      tooLarge: false,
    },
  };
}

function createTooLargeWorkspaceFileDetail(file: WorkspaceFile): WorkspaceFileDetail {
  return {
    kind: 'tooLarge',
    file: {
      ...file,
      isTextEditable: true,
      tooLarge: true,
    },
  };
}

export function isEditableDetail(detail: WorkspaceFileDetail | null): detail is Extract<WorkspaceFileDetail, { kind: 'editable' }> {
  return detail?.kind === 'editable';
}

export function applyDirectoryState({
  actionId,
  entries,
  path,
  notice = '',
  openExplorer = true,
  preserveEditor = false,
  isCurrentAction,
  mutators,
}: {
  actionId: number;
  entries: WorkspaceFileEntry[];
  path: string;
  notice?: string;
  openExplorer?: boolean;
  preserveEditor?: boolean;
  isCurrentAction: (actionId: number) => boolean;
  mutators: WorkspaceExplorerMutators;
}) {
  if (!isCurrentAction(actionId)) {
    return false;
  }

  mutators.setWorkspaceExplorerEntries(entries);
  mutators.setWorkspaceExplorerPath(path);
  mutators.setWorkspaceExplorerOpen(openExplorer);
  mutators.setWorkspaceExplorerNotice(notice);

  if (!preserveEditor) {
    mutators.clearWorkspaceEditor();
  }

  return true;
}

export async function openWorkspaceDirectory({
  workspace,
  actionId,
  path,
  notice = '',
  openExplorer = true,
  preserveEditor = false,
  isCurrentAction,
  mutators,
}: {
  workspace: string;
  actionId: number;
  path: string;
  notice?: string;
  openExplorer?: boolean;
  preserveEditor?: boolean;
  isCurrentAction: (actionId: number) => boolean;
  mutators: WorkspaceExplorerMutators;
}) {
  const entries = await fetchWorkspaceFiles({ workspace, path });
  return applyDirectoryState({ actionId, entries, path, notice, openExplorer, preserveEditor, isCurrentAction, mutators });
}

export async function openWorkspaceFile({
  workspace,
  path,
  actionId,
  isCurrentAction,
  mutators,
}: {
  workspace: string;
  path: string;
  actionId: number;
  isCurrentAction: (actionId: number) => boolean;
  mutators: WorkspaceExplorerMutators;
}) {
  const parentPath = getParentRelativePath(path);
  const [entries, file] = await Promise.all([
    fetchWorkspaceFiles({ workspace, path: parentPath }),
    fetchWorkspaceFile({ workspace, path }),
  ]);

  if (!isCurrentAction(actionId)) {
    return false;
  }

  if (file.tooLarge) {
    mutators.setWorkspaceExplorerEntries(entries);
    mutators.setWorkspaceExplorerPath(parentPath);
    mutators.setWorkspaceExplorerOpen(true);
    mutators.setWorkspaceExplorerNotice('');
    mutators.setWorkspaceFileDetail(createTooLargeWorkspaceFileDetail(file));
    mutators.setWorkspaceFileDraft('');
    return true;
  }

  mutators.setWorkspaceExplorerEntries(entries);
  mutators.setWorkspaceExplorerPath(parentPath);
  mutators.setWorkspaceExplorerOpen(true);
  mutators.setWorkspaceExplorerNotice('');
  mutators.setWorkspaceFileDetail(createEditableWorkspaceFileDetail(file));
  mutators.setWorkspaceFileDraft(file.content);
  return true;
}

export async function openWorkspaceFileWithEntries({
  workspace,
  actionId,
  path,
  entries,
  isCurrentAction,
  mutators,
}: {
  workspace: string;
  actionId: number;
  path: string;
  entries: WorkspaceFileEntry[];
  isCurrentAction: (actionId: number) => boolean;
  mutators: WorkspaceExplorerMutators;
}) {
  const parentPath = getParentRelativePath(path);
  const file = await fetchWorkspaceFile({ workspace, path });

  if (!isCurrentAction(actionId)) {
    return false;
  }

  if (file.tooLarge) {
    mutators.setWorkspaceExplorerEntries(entries);
    mutators.setWorkspaceExplorerPath(parentPath);
    mutators.setWorkspaceExplorerOpen(true);
    mutators.setWorkspaceExplorerNotice('');
    mutators.setWorkspaceFileDetail(createTooLargeWorkspaceFileDetail(file));
    mutators.setWorkspaceFileDraft('');
    return true;
  }

  mutators.setWorkspaceExplorerEntries(entries);
  mutators.setWorkspaceExplorerPath(parentPath);
  mutators.setWorkspaceExplorerOpen(true);
  mutators.setWorkspaceExplorerNotice('');
  mutators.setWorkspaceFileDetail(createEditableWorkspaceFileDetail(file));
  mutators.setWorkspaceFileDraft(file.content);
  return true;
}

export function createReadOnlyDetailFromEntry(path: string, entry?: WorkspaceFileEntry) {
  return createReadOnlyWorkspaceFileDetail({
    path,
    name: entry?.name,
    size: entry?.size ?? 0,
  });
}
