import { HttpError, createHttpError } from '../../common/errors/http-error.js';
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
export function isWorkspaceErrorCode(error, code) {
    return error instanceof HttpError && error.code === code;
}
//# sourceMappingURL=workspace-errors.js.map