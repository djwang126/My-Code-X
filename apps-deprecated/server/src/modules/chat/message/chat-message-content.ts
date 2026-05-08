import { createHttpError } from '../../../common/errors/http-error.js';
const MAX_IMAGE_ATTACHMENTS = 5;
export type MessageContentItem =
    | { type: 'text'; text: string; text_elements?: unknown[] }
    | { type: 'imageAttachment'; attachmentId: string };
function normalizeTextItem(item: any): MessageContentItem | null {
    if (!item || item.type !== 'text') {
        return null;
    }
    const text = typeof item.text === 'string' ? item.text : '';
    return {
        type: 'text',
        text,
        ...(Array.isArray(item.text_elements) ? { text_elements: item.text_elements } : {}),
    };
}
function normalizeImageAttachmentItem(item: any): MessageContentItem | null {
    if (!item || item.type !== 'imageAttachment') {
        return null;
    }
    const attachmentId = typeof item.attachmentId === 'string' ? item.attachmentId.trim() : '';
    if (!attachmentId) {
        throw createHttpError('image attachments require a non-empty attachmentId', 400, 'attachment_id_is_required');
    }
    return {
        type: 'imageAttachment',
        attachmentId,
    };
}
function normalizeAllowedItem(item: any): MessageContentItem | null {
    if (!item || typeof item !== 'object' || typeof item.type !== 'string') {
        return null;
    }
    throw createHttpError(`unsupported content item type: ${item.type}`, 400, 'unsupported_content_item_type');
}
export function normalizeMessageContent({ text, content }: any) {
    if (Array.isArray(content) && content.length) {
        const normalizedContent = content
            .map(item => normalizeTextItem(item) ?? normalizeImageAttachmentItem(item) ?? normalizeAllowedItem(item))
            .filter((item): item is MessageContentItem => item !== null);
        const attachmentCount = normalizedContent.filter(item => item.type === 'imageAttachment').length;
        if (attachmentCount > MAX_IMAGE_ATTACHMENTS) {
            throw createHttpError('a message can contain at most 5 image attachments', 400, 'content_exceeds_attachment_limit');
        }
        if (!normalizedContent.length) {
            throw createHttpError('content is required', 400, 'content_is_required');
        }
        return normalizedContent;
    }
    const trimmedText = typeof text === 'string' ? text.trim() : '';
    if (!trimmedText) {
        throw createHttpError('text is required', 400, 'text_is_required');
    }
    return [{ type: 'text', text: trimmedText }];
}
export function extractMessagePreviewText(content: any) {
    if (!Array.isArray(content)) {
        return '';
    }
    return content
        .map((item: MessageContentItem) => (item.type === 'text' ? item.text : ''))
        .filter(Boolean)
        .join('\n\n')
        .trim();
}
