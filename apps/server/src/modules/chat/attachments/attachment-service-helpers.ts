export function sanitizeAttachmentFilename(filename: any) {
    const basename = String(filename || '').trim().split(/[/\\]/).at(-1) || '';
    const sanitized = Array.from(basename, character => character < ' ' || '<>:"/\\|?*'.includes(character) ? '_' : character).join('').trim();
    return sanitized || 'attachment-upload';
}
export function createTimestamp(now: any) {
    const value = now();
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
export async function touchAttachmentRecord({ metadataStore, now, attachmentId }: any) {
    if (!attachmentId) {
        return null;
    }
    return metadataStore.touch(attachmentId, createTimestamp(now));
}
export async function touchAttachmentBySavedPath({ metadataStore, now, savedPath }: any) {
    if (!savedPath) {
        return null;
    }
    return metadataStore.touchBySavedPath(savedPath, createTimestamp(now));
}
export function listAttachmentIds(content: any) {
    if (!Array.isArray(content)) {
        return [];
    }
    return Array.from(new Set(content
        .filter((item: any) => item?.type === 'imageAttachment' && typeof item.attachmentId === 'string')
        .map((item: any) => item.attachmentId.trim())
        .filter(Boolean)));
}
export function resolveErrorReason(error: any) {
    if (typeof error?.code === 'string' && error.code.trim()) {
        return error.code;
    }
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return String(error);
}
