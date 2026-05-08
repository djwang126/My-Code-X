import { basename, extname } from 'node:path';
export function buildWorkspaceFileContentUrl({ workspace, path, }) {
    const search = new URLSearchParams({ workspace, path });
    return `/api/v2/workspace/file/content?${search.toString()}`;
}
export function createWorkspaceDirectoryEntry({ name, path, }) {
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
export function createWorkspaceListedFileEntry({ contentKind, isLarge, name, path, size, }) {
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
export function createWorkspaceTextFileResponse({ content, path, size, truncated, }) {
    return {
        kind: 'text',
        path,
        name: basename(path),
        size,
        encoding: 'utf-8',
        content,
        truncated,
    };
}
export function createWorkspaceImageFileResponse({ contentType, path, size, workspace, }) {
    return {
        kind: 'image',
        path,
        name: basename(path),
        size,
        contentType,
        url: buildWorkspaceFileContentUrl({ workspace, path }),
    };
}
export function createWorkspaceBinaryFileResponse({ contentType, path, size, }) {
    return {
        kind: 'binary',
        path,
        name: basename(path),
        size,
        contentType,
    };
}
//# sourceMappingURL=workspace-file-presenters.js.map