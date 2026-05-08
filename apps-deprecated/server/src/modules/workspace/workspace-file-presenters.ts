import { basename, extname } from 'node:path';
import type { WorkspaceContentKind, WorkspaceFileEntry } from '@my-code-x/contracts';

export function buildWorkspaceFileContentUrl({
  workspace,
  path,
}: {
  workspace: string;
  path: string;
}) {
  const search = new URLSearchParams({ workspace, path });
  return `/api/v2/workspace/file/content?${search.toString()}`;
}

export function createWorkspaceDirectoryEntry({
  name,
  path,
}: {
  name: string;
  path: string;
}): WorkspaceFileEntry {
  return {
    path,
    name,
    kind: 'directory',
    size: 0,
    ext: '',
    contentKind: null,
    isLarge: false,
  };
}

export function createWorkspaceListedFileEntry({
  contentKind,
  isLarge,
  name,
  path,
  size,
}: {
  contentKind: WorkspaceContentKind;
  isLarge: boolean;
  name: string;
  path: string;
  size: number;
}): WorkspaceFileEntry {
  return {
    path,
    name,
    kind: 'file',
    size,
    ext: extname(name).toLowerCase(),
    contentKind,
    isLarge,
  };
}

export function createWorkspaceTextFileResponse({
  content,
  path,
  size,
  truncated,
}: {
  content: string;
  path: string;
  size: number;
  truncated: boolean;
}) {
  return {
    kind: 'text' as const,
    path,
    name: basename(path),
    size,
    encoding: 'utf-8' as const,
    content,
    truncated,
  };
}

export function createWorkspaceImageFileResponse({
  contentType,
  path,
  size,
  workspace,
}: {
  contentType: string;
  path: string;
  size: number;
  workspace: string;
}) {
  return {
    kind: 'image' as const,
    path,
    name: basename(path),
    size,
    contentType,
    url: buildWorkspaceFileContentUrl({ workspace, path }),
  };
}

export function createWorkspaceBinaryFileResponse({
  contentType,
  path,
  size,
}: {
  contentType: string | null;
  path: string;
  size: number;
}) {
  return {
    kind: 'binary' as const,
    path,
    name: basename(path),
    size,
    contentType,
  };
}
