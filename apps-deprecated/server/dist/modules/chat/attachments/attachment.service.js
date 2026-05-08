import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createHttpError } from '../../../common/errors/http-error.js';
import { createAttachmentDisplayContentService } from './attachment-display-content.js';
import { createAttachmentMetadataRepository } from './attachment-metadata.repository.js';
import { createAttachmentProcessingService } from './attachment-processing.service.js';
import { createSharpImageAdapter } from './sharp-image-adapter.js';
import { createAttachmentStorageService } from './attachment-storage.service.js';
import { RAW_UPLOAD_LIMIT_BYTES } from './attachment-limits.js';
import { createTimestamp, listAttachmentIds, resolveErrorReason, sanitizeAttachmentFilename, touchAttachmentRecord, } from './attachment-service-helpers.js';
import { assertAttachmentReadable, createAttachmentContentUrl, normalizeAttachmentAccessContext, } from './attachment-content-access.js';
async function hashFile(filePath) {
    const buffer = await readFile(filePath);
    return `sha256:${crypto.createHash('sha256').update(buffer).digest('hex')}`;
}
function createRandomId() {
    return `att-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}
export function createAttachmentService({ appDataRoot = path.join(os.homedir(), '.my-code-x'), logger = console, now = () => new Date(), imageAdapter = createSharpImageAdapter(), metadataStore = createAttachmentMetadataRepository({
    metadataPath: path.join(appDataRoot, 'attachments', 'metadata.json'),
}), resolveSessionRuntime = (_selection) => null, processingService = createAttachmentProcessingService({
    outputRoot: path.join(appDataRoot, 'attachments', 'processed'),
    imageAdapter,
    logger,
    randomId: createRandomId,
}), storageService = createAttachmentStorageService({
    appDataRoot,
    metadataStore,
    randomId: createRandomId,
    hashFile,
}), } = {}) {
    let sessionRuntimeResolver = resolveSessionRuntime;
    const displayContentService = createAttachmentDisplayContentService({
        metadataStore,
        now,
        createContentUrl: createAttachmentContentUrl,
    });
    async function uploadAttachment({ buffer, contentType, filename, viewerId = 'anonymous', threadId = '' }) {
        if (!contentType.startsWith('image/')) {
            throw createHttpError('only image attachments are supported', 400, 'unsupported_attachment_type');
        }
        if (buffer.byteLength > RAW_UPLOAD_LIMIT_BYTES) {
            throw createHttpError('attachment_upload_too_large', 413, 'attachment_upload_too_large');
        }
        const tempDir = await mkdtemp(path.join(os.tmpdir(), 'my-code-x-upload-'));
        const safeFilename = sanitizeAttachmentFilename(filename);
        const tempPath = path.join(tempDir, safeFilename);
        await writeFile(tempPath, buffer);
        logger?.info?.({
            event: 'attachment_upload_started',
            filename: safeFilename,
            contentType,
            viewerId,
            threadId,
            byteLength: buffer.byteLength,
        });
        try {
            const processed = await processingService.processAttachment({
                sourcePath: tempPath,
                originalFilename: safeFilename,
                contentType,
            });
            const persisted = await storageService.persistProcessedAttachment({
                viewerId,
                threadId,
                workspaceRoot: '',
                originalFilename: safeFilename,
                processedFile: {
                    ...processed,
                    sourcePath: processed.savedPath,
                },
            });
            await rm(processed.savedPath, { force: true });
            logger?.info?.({
                event: 'attachment_upload_completed',
                attachmentId: persisted.attachmentId,
                filename: safeFilename,
                contentType: persisted.contentType,
                viewerId,
                threadId,
                width: persisted.width,
                height: persisted.height,
                byteLength: persisted.byteLength,
            });
            return {
                attachmentId: persisted.attachmentId,
                contentType: persisted.contentType,
                width: persisted.width,
                height: persisted.height,
                byteLength: persisted.byteLength,
            };
        }
        catch (error) {
            logger?.warn?.({
                event: 'attachment_upload_failed',
                filename: safeFilename,
                contentType,
                viewerId,
                threadId,
                reason: resolveErrorReason(error),
            });
            throw error;
        }
        finally {
            await rm(tempDir, { recursive: true, force: true });
        }
    }
    async function getAttachmentContent({ attachmentId, slotId, threadId }) {
        const accessContext = normalizeAttachmentAccessContext({ slotId, threadId });
        try {
            const record = await metadataStore.getById(attachmentId);
            assertAttachmentReadable({
                record,
                runtime: sessionRuntimeResolver(accessContext),
                accessContext,
            });
            const body = await readFile(record.savedPath).catch(() => {
                throw createHttpError('attachment_not_found', 404, 'attachment_not_found');
            });
            await touchAttachmentRecord({ metadataStore, now, attachmentId: record.attachmentId });
            logger?.info?.({
                event: 'attachment_content_served',
                attachmentId: record.attachmentId,
                savedPath: record.savedPath,
                contentType: record.contentType,
            });
            return {
                contentType: record.contentType,
                body,
            };
        }
        catch (error) {
            logger?.warn?.({
                event: 'attachment_content_read_failed',
                attachmentId,
                slotId: accessContext.slotId,
                threadId: accessContext.threadId,
                reason: resolveErrorReason(error),
            });
            throw error;
        }
    }
    async function resolveContent(content) {
        const resolved = [];
        for (const item of content) {
            if (item?.type !== 'imageAttachment') {
                resolved.push(item);
                continue;
            }
            const record = await metadataStore.getById(item.attachmentId);
            if (!record) {
                logger?.warn?.({
                    event: 'attachment_handoff_failed',
                    attachmentId: item.attachmentId,
                    reason: 'attachment_not_found',
                });
                throw createHttpError('attachment_not_found', 404, 'attachment_not_found');
            }
            await touchAttachmentRecord({ metadataStore, now, attachmentId: record.attachmentId });
            logger?.info?.({
                event: 'attachment_handoff_resolved',
                attachmentId: record.attachmentId,
                savedPath: record.savedPath,
                contentType: record.contentType,
            });
            resolved.push({ type: 'localImage', path: record.savedPath });
        }
        return resolved;
    }
    async function markAttachmentsReferenced({ content, threadId }) {
        if (!threadId) {
            return [];
        }
        const attachmentIds = listAttachmentIds(content);
        const lastReferencedAt = createTimestamp(now);
        const updatedRecords = [];
        for (const attachmentId of attachmentIds) {
            const record = await metadataStore.appendThreadReference(attachmentId, threadId, lastReferencedAt);
            if (record) {
                updatedRecords.push(record);
            }
        }
        return updatedRecords;
    }
    return {
        metadataStore,
        setSessionRuntimeResolver(nextResolver) {
            sessionRuntimeResolver = typeof nextResolver === 'function' ? nextResolver : () => null;
        },
        uploadAttachment,
        getAttachmentContent,
        createDisplayContent: displayContentService.createDisplayContent,
        hydrateTimelineItems: displayContentService.hydrateTimelineItems,
        resolveContent,
        markAttachmentsReferenced,
    };
}
//# sourceMappingURL=attachment.service.js.map