import { HttpError, createHttpError } from '../../common/errors/http-error.js';

type WorkspaceErrorCode =
  | 'not_found'
  | 'not_text_file'
  | 'not_image_file'
  | 'outside_workspace'
  | 'unsupported_image_type'
  | 'workspace_required'
  | 'path_required';

export function createWorkspaceNotFoundError() {
  return createHttpError('not_found', 404, 'not_found');
}

export function createWorkspaceNotTextFileError() {
  return createHttpError('not_text_file', 415, 'not_text_file');
}

export function createWorkspaceNotImageFileError() {
  return createHttpError('not_image_file', 415, 'not_image_file');
}

export function createWorkspaceOutsideBoundaryError() {
  return createHttpError('outside_workspace', 403, 'outside_workspace');
}

export function createWorkspaceUnsupportedImageTypeError() {
  return createHttpError('unsupported_image_type', 415, 'unsupported_image_type');
}

export function createWorkspaceRequiredError() {
  return createHttpError('workspace is required', 400, 'workspace_required');
}

export function createWorkspacePathRequiredError() {
  return createHttpError('path is required', 400, 'path_required');
}

export function isWorkspaceErrorCode(error: unknown, code: WorkspaceErrorCode) {
  return error instanceof HttpError && error.code === code;
}
