import { touchAttachmentBySavedPath, touchAttachmentRecord, } from './attachment-service-helpers.js';
function createDisplayContentUrl({ createContentUrl, accessContext, attachmentId, fallbackUrl = '' }: any) {
    if (!accessContext?.slotId || !accessContext?.threadId) {
        return fallbackUrl;
    }
    return createContentUrl({
        attachmentId,
        slotId: accessContext.slotId,
        threadId: accessContext.threadId,
    });
}
export function createAttachmentDisplayContentService({ metadataStore, now, createContentUrl, }: any) {
    async function toDisplayContentItem(item: any, accessContext: any) {
        if (!item || typeof item !== 'object') {
            return item;
        }
        if (item.type === 'imageAttachment' || (item.type === 'image' && item.attachmentId)) {
            const record = await metadataStore.getById(item.attachmentId);
            if (!record) {
                return {
                    type: 'image',
                    attachmentId: item.attachmentId,
                    status: 'unavailable',
                };
            }
            await touchAttachmentRecord({ metadataStore, now, attachmentId: record.attachmentId });
            return {
                type: 'image',
                attachmentId: record.attachmentId,
                url: createDisplayContentUrl({
                    createContentUrl,
                    accessContext,
                    attachmentId: record.attachmentId,
                    fallbackUrl: item.url,
                }),
            };
        }
        if (item.type === 'localImage') {
            const record = await metadataStore.getBySavedPath(item.path);
            if (!record) {
                return {
                    type: 'image',
                    status: 'unavailable',
                };
            }
            await touchAttachmentBySavedPath({ metadataStore, now, savedPath: item.path });
            return {
                type: 'image',
                attachmentId: record.attachmentId,
                url: createDisplayContentUrl({
                    createContentUrl,
                    accessContext,
                    attachmentId: record.attachmentId,
                }),
            };
        }
        if (item.type === 'image') {
            return item;
        }
        return item;
    }
    async function createDisplayContent(content: any, accessContext: any = undefined) {
        if (!Array.isArray(content)) {
            return [];
        }
        return Promise.all(content.map((item: any) => toDisplayContentItem(item, accessContext)));
    }
    async function hydrateTimelineItems(items: any, accessContext: any = undefined) {
        if (!Array.isArray(items)) {
            return [];
        }
        return Promise.all(items.map(async (item: any) => {
            if (item?.kind !== 'message' || item?.itemType !== 'userMessage' || !Array.isArray(item.content)) {
                return item;
            }
            const content = await createDisplayContent(item.content, accessContext);
            return {
                ...item,
                content,
                raw: item.raw ? { ...item.raw, content } : item.raw,
            };
        }));
    }
    return {
        createDisplayContent,
        hydrateTimelineItems,
    };
}
