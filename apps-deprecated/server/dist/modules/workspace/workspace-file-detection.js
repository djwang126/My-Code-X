import { extname } from 'node:path';
import { open, readFile } from 'node:fs/promises';
export const MAX_WORKSPACE_TEXT_PREVIEW_BYTES = 128 * 1024;
const MAX_DETECTION_SAMPLE_BYTES = 4096;
const IMAGE_CONTENT_TYPES = new Map([
    ['.png', 'image/png'],
    ['.jpg', 'image/jpeg'],
    ['.jpeg', 'image/jpeg'],
    ['.gif', 'image/gif'],
    ['.webp', 'image/webp'],
    ['.bmp', 'image/bmp'],
    ['.ico', 'image/x-icon'],
    ['.avif', 'image/avif'],
]);
function trimIncompleteUtf8Tail(buffer) {
    for (let trimBytes = 0; trimBytes < 4 && trimBytes <= buffer.length; trimBytes += 1) {
        const candidate = trimBytes === 0 ? buffer : buffer.subarray(0, buffer.length - trimBytes);
        try {
            new TextDecoder('utf-8', { fatal: true }).decode(candidate);
            return candidate;
        }
        catch {
            continue;
        }
    }
    return null;
}
function containsBinaryMarkers(buffer) {
    for (const byte of buffer) {
        if (byte === 0) {
            return true;
        }
    }
    return false;
}
export function getWorkspaceImageContentType(path) {
    return IMAGE_CONTENT_TYPES.get(extname(path).toLowerCase()) ?? null;
}
export async function readFileSample({ target, maxBytes, }) {
    const fileHandle = await open(target, 'r');
    try {
        const buffer = Buffer.alloc(maxBytes);
        const { bytesRead } = await fileHandle.read(buffer, 0, maxBytes, 0);
        return buffer.subarray(0, bytesRead);
    }
    finally {
        await fileHandle.close();
    }
}
export async function detectWorkspaceFileContentKind(target, path) {
    if (getWorkspaceImageContentType(path)) {
        return 'image';
    }
    const sample = await readFileSample({ target, maxBytes: MAX_DETECTION_SAMPLE_BYTES });
    if (!sample.length) {
        return 'text';
    }
    if (containsBinaryMarkers(sample)) {
        return 'binary';
    }
    const trimmed = trimIncompleteUtf8Tail(sample);
    return trimmed ? 'text' : 'binary';
}
export async function readWorkspaceTextFile({ target, maxBytes, }) {
    if (maxBytes === null) {
        return {
            content: await readFile(target, 'utf8'),
            truncated: false,
        };
    }
    const sample = await readFileSample({ target, maxBytes: maxBytes + 4 });
    const trimmed = trimIncompleteUtf8Tail(sample);
    if (trimmed === null) {
        return null;
    }
    return {
        content: trimmed.toString('utf8'),
        truncated: sample.length > trimmed.length || sample.length > maxBytes,
    };
}
//# sourceMappingURL=workspace-file-detection.js.map