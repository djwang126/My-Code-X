import type { Dispatch, SetStateAction } from 'react';
import type { WorkspaceFileDetail, WorkspaceFileEntry, WorkspaceTextFile } from '../public-types';
import { fetchWorkspaceFile, fetchWorkspaceFiles } from '../api/workspace-file-api';
import { getParentRelativePath } from './workspace-file-paths';

type WorkspaceExplorerMutators = {
  setWorkspaceExplorerEntries: Dispatch<SetStateAction<WorkspaceFileEntry[]>>;
  setWorkspaceExplorerPath: (path: string) => void;
  setWorkspaceExplorerOpen: (open: boolean) => void;
  setWorkspaceExplorerNotice: (notice: string) => void;
  setWorkspaceFileDetail: Dispatch<SetStateAction<WorkspaceFileDetail | null>>;
  setWorkspaceFileDraft: (draft: string) => void;
  clearWorkspaceEditor: () => void;
};

export function isTextDetail(detail: WorkspaceFileDetail | null): detail is WorkspaceTextFile {
  return detail?.kind === 'text';
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

function applyFileState({
  detail,
  entries,
  parentPath,
  mutators,
}: {
  detail: WorkspaceFileDetail;
  entries: WorkspaceFileEntry[];
  parentPath: string;
  mutators: WorkspaceExplorerMutators;
}) {
  mutators.setWorkspaceExplorerEntries(entries);
  mutators.setWorkspaceExplorerPath(parentPath);
  mutators.setWorkspaceExplorerOpen(true);
  mutators.setWorkspaceExplorerNotice('');
  mutators.setWorkspaceFileDetail(detail);
  mutators.setWorkspaceFileDraft(detail.kind === 'text' ? detail.content : '');
  return true;
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
  const [entries, detail] = await Promise.all([
    fetchWorkspaceFiles({ workspace, path: parentPath }),
    fetchWorkspaceFile({ workspace, path }),
  ]);

  if (!isCurrentAction(actionId)) {
    return false;
  }

  return applyFileState({ detail, entries, parentPath, mutators });
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
  const detail = await fetchWorkspaceFile({ workspace, path });

  if (!isCurrentAction(actionId)) {
    return false;
  }

  return applyFileState({ detail, entries, parentPath, mutators });
}

export async function loadFullWorkspaceTextFile({
  workspace,
  path,
}: {
  workspace: string;
  path: string;
}) {
  const detail = await fetchWorkspaceFile({ workspace, path, full: true });
  if (detail.kind !== 'text') {
    return null;
  }

  return detail;
}
