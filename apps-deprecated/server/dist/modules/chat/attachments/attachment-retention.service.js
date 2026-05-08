import { access, rm } from 'node:fs/promises';
async function fileExists(filePath) {
    try {
        await access(filePath);
        return true;
    }
    catch {
        return false;
    }
}
function isExpired(record, nowMs) {
    if (Array.isArray(record.threadIds) && record.threadIds.length) {
        return false;
    }
    const lastReferencedAt = Date.parse(record.lastReferencedAt || '');
    if (!Number.isFinite(lastReferencedAt)) {
        return true;
    }
    return nowMs - lastReferencedAt > 30 * 24 * 60 * 60 * 1000;
}
export function createAttachmentRetentionService({ metadataStore, now = () => new Date(), logger, }) {
    async function pruneExpiredAttachments() {
        const currentValue = now();
        const nowMs = currentValue instanceof Date ? currentValue.getTime() : new Date(currentValue).getTime();
        const records = await metadataStore.load();
        const keptAttachmentIds = [];
        const prunedAttachmentIds = [];
        const missingAttachmentIds = [];
        const nextRecords = [];
        for (const record of records) {
            const threadIds = Array.isArray(record.threadIds) ? [...record.threadIds] : [];
            const exists = await fileExists(record.savedPath);
            if (!exists) {
                missingAttachmentIds.push(record.attachmentId);
                logger?.warn?.({
                    event: 'attachment_metadata_converged',
                    attachmentId: record.attachmentId,
                    savedPath: record.savedPath,
                    reason: 'file_missing_on_disk',
                });
                continue;
            }
            if (!threadIds.length && isExpired(record, nowMs)) {
                await rm(record.savedPath, { force: true });
                prunedAttachmentIds.push(record.attachmentId);
                continue;
            }
            keptAttachmentIds.push(record.attachmentId);
            nextRecords.push({
                ...record,
                threadIds,
            });
        }
        await metadataStore.save(nextRecords);
        return {
            keptAttachmentIds,
            prunedAttachmentIds,
            missingAttachmentIds,
        };
    }
    return {
        pruneExpiredAttachments,
    };
}
//# sourceMappingURL=attachment-retention.service.js.map