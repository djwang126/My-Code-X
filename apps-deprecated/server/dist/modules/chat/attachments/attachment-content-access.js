import { createHttpError } from '../../../common/errors/http-error.js';
function createAttachmentQuery({ slotId, threadId }) {
    const params = new URLSearchParams({
        slotId: String(slotId || '').trim(),
        threadId: String(threadId || '').trim(),
    });
    return params.toString();
}
export function createAttachmentContentUrl({ attachmentId, slotId, threadId, }) {
    const query = createAttachmentQuery({ slotId, threadId });
    return `/api/v2/chat/attachments/${encodeURIComponent(attachmentId)}/content?${query}`;
}
export function normalizeAttachmentAccessContext({ slotId, threadId } = {}) {
    return {
        slotId: String(slotId || '').trim(),
        threadId: String(threadId || '').trim(),
    };
}
export function assertAttachmentReadable({ record, runtime, accessContext, }) {
    if (!accessContext.slotId) {
        throw createHttpError('slotId is required', 400, 'slotid_is_required');
    }
    if (!accessContext.threadId) {
        throw createHttpError('threadId is required', 400, 'threadid_is_required');
    }
    if (!record) {
        throw createHttpError('attachment_not_found', 404, 'attachment_not_found');
    }
    if (!runtime || runtime.threadId !== accessContext.threadId || runtime.slotId !== accessContext.slotId) {
        throw createHttpError('attachment_access_denied', 403, 'attachment_access_denied');
    }
    if (record.viewerId && runtime.viewerId !== record.viewerId) {
        throw createHttpError('attachment_access_denied', 403, 'attachment_access_denied');
    }
    if (!Array.isArray(record.threadIds) || !record.threadIds.includes(accessContext.threadId)) {
        throw createHttpError('attachment_access_denied', 403, 'attachment_access_denied');
    }
    return record;
}
//# sourceMappingURL=attachment-content-access.js.map