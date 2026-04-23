export type WorkspaceContentKind = 'text' | 'image' | 'binary';

export type WorkspaceDirectoryEntry = {
  path: string;
  name: string;
  kind: 'directory';
  size: 0;
  ext: '';
  contentKind: null;
  isLarge: false;
};

export type WorkspaceListedFileEntry = {
  path: string;
  name: string;
  kind: 'file';
  size: number;
  ext: string;
  contentKind: WorkspaceContentKind;
  isLarge: boolean;
};

export type WorkspaceFileEntry = WorkspaceDirectoryEntry | WorkspaceListedFileEntry;

export type WorkspaceFilesPayload = {
  data: WorkspaceFileEntry[];
};

export type WorkspaceTextFile = {
  kind: 'text';
  path: string;
  name: string;
  size: number;
  encoding: 'utf-8';
  content: string;
  truncated: boolean;
};

export type WorkspaceImageFile = {
  kind: 'image';
  path: string;
  name: string;
  size: number;
  contentType: string;
  url: string;
};

export type WorkspaceBinaryFile = {
  kind: 'binary';
  path: string;
  name: string;
  size: number;
  contentType: string | null;
};

export type WorkspaceFile = WorkspaceTextFile | WorkspaceImageFile | WorkspaceBinaryFile;

export type WorkspaceFileDetail = WorkspaceFile;

export type WorkspaceFileSaveAcceptedPayload = {
  ok: boolean;
  path: string;
  size: number;
  updatedAt: string;
};
