import { SessionApiError } from '../../../../shared/lib/app-api-client';

type WorkspacePathErrorInput = {
  path: string;
};

export class WorkspacePathNotFoundError extends Error {
  readonly path: string;

  constructor({ path }: WorkspacePathErrorInput) {
    super(`The workspace path "${path}" could not be found.`);
    this.name = 'WorkspacePathNotFoundError';
    this.path = path;
  }
}

export class WorkspaceFileNotTextEditableError extends Error {
  readonly path: string;

  constructor({ path }: WorkspacePathErrorInput) {
    super(`The workspace file "${path}" is not text editable.`);
    this.name = 'WorkspaceFileNotTextEditableError';
    this.path = path;
  }
}

export class WorkspaceOutsideCurrentWorkspaceError extends Error {
  constructor() {
    super('The selected file is outside the current workspace.');
    this.name = 'WorkspaceOutsideCurrentWorkspaceError';
  }
}

type ResolveWorkspaceExplorerApiErrorInput = {
  error: unknown;
  path: string;
};

export function resolveWorkspaceExplorerApiError({
  error,
  path,
}: ResolveWorkspaceExplorerApiErrorInput) {
  if (!(error instanceof SessionApiError)) {
    return error;
  }

  if (error.status === 404) {
    return new WorkspacePathNotFoundError({ path });
  }

  if (error.status === 415) {
    return new WorkspaceFileNotTextEditableError({ path });
  }

  return error;
}
