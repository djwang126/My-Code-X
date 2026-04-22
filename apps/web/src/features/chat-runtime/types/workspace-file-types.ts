export type WorkspaceFileEntry = {
  path: string;
  name: string;
  kind: 'directory' | 'file';
  size: number;
  ext: string;
  isTextEditable: boolean;
};

export type WorkspaceFilesPayload = {
  data: WorkspaceFileEntry[];
};

export type WorkspaceFile = {
  path: string;
  name: string;
  size: number;
  encoding: string;
  content: string;
  isTextEditable: boolean;
  tooLarge: boolean;
};

export type WorkspaceEditableFileDetail = {
  kind: 'editable';
  file: WorkspaceFile & { isTextEditable: true; tooLarge: false };
};

export type WorkspaceTooLargeFileDetail = {
  kind: 'tooLarge';
  file: WorkspaceFile & { isTextEditable: true; tooLarge: true };
};

export type WorkspaceReadOnlyFileDetail = {
  kind: 'readOnly';
  path: string;
  name: string;
  size: number;
};

export type WorkspaceFileDetail =
  | WorkspaceEditableFileDetail
  | WorkspaceTooLargeFileDetail
  | WorkspaceReadOnlyFileDetail;

export type WorkspaceFileSaveAcceptedPayload = {
  ok: boolean;
  path: string;
  size: number;
  updatedAt: string;
};
