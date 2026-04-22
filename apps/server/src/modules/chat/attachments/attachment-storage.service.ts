import path from 'node:path';
import { copyFile, mkdir } from 'node:fs/promises';
function toIsoString(now: any) {
    return now instanceof Date ? now.toISOString() : new Date(now).toISOString();
}
function extensionFromContentType(contentType: any) {
    switch (contentType) {
        case 'image/jpeg':
            return '.jpg';
        case 'image/png':
            return '.png';
        case 'image/webp':
            return '.webp';
        case 'image/gif':
            return '.gif';
        default:
            return '';
    }
}
export function createAttachmentStorageService({ appDataRoot, metadataStore, now = () => new Date(), randomId = () => `att-${Date.now()}`, hashFile, }: any) {
    async function persistProcessedAttachment({ viewerId, threadId, workspaceRoot, originalFilename, processedFile }: any) {
        const attachmentId = randomId();
        const createdAt = toIsoString(now());
        const date = new Date(createdAt);
        const shard = [
            String(date.getUTCFullYear()),
            String(date.getUTCMonth() + 1).padStart(2, '0'),
            String(date.getUTCDate()).padStart(2, '0'),
        ];
        const targetDir = path.join(appDataRoot, 'attachments', ...shard);
        const savedPath = path.join(targetDir, `${attachmentId}${extensionFromContentType(processedFile.contentType)}`);
        await mkdir(targetDir, { recursive: true });
        await copyFile(processedFile.sourcePath, savedPath);
        const record = {
            attachmentId,
            viewerId,
            threadIds: threadId ? [threadId] : [],
            savedPath,
            originalFilename,
            contentHash: await hashFile(savedPath),
            contentType: processedFile.contentType,
            width: processedFile.width,
            height: processedFile.height,
            byteLength: processedFile.byteLength,
            createdAt,
            lastReferencedAt: createdAt,
        };
        await metadataStore.save(record);
        return {
            attachmentId,
            savedPath,
            contentType: processedFile.contentType,
            width: processedFile.width,
            height: processedFile.height,
            byteLength: processedFile.byteLength,
            workspaceRoot,
        };
    }
    return {
        persistProcessedAttachment,
    };
}
