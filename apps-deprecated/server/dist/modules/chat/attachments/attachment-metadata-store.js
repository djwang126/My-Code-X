import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
function isMissingFileError(error) {
    return Boolean(error && typeof error === 'object' && error.code === 'ENOENT');
}
export function createAttachmentMetadataStore({ metadataPath }) {
    async function readAll() {
        try {
            const raw = await readFile(metadataPath, 'utf8');
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        }
        catch (error) {
            if (isMissingFileError(error)) {
                return [];
            }
            throw error;
        }
    }
    async function writeAll(records) {
        await mkdir(path.dirname(metadataPath), { recursive: true });
        await writeFile(metadataPath, JSON.stringify(records, null, 2));
    }
    async function updateRecord(predicate, updater) {
        const records = await readAll();
        const existingIndex = records.findIndex(predicate);
        if (existingIndex === -1) {
            return null;
        }
        const currentRecord = records[existingIndex];
        const nextRecord = updater({
            ...currentRecord,
            threadIds: Array.isArray(currentRecord.threadIds) ? [...currentRecord.threadIds] : [],
        });
        if (!nextRecord) {
            return null;
        }
        records[existingIndex] = nextRecord;
        await writeAll(records);
        return nextRecord;
    }
    async function save(recordOrRecords) {
        if (Array.isArray(recordOrRecords)) {
            await writeAll(recordOrRecords);
            return;
        }
        const records = await readAll();
        const existingIndex = records.findIndex(record => record.attachmentId === recordOrRecords.attachmentId);
        if (existingIndex === -1) {
            records.push(recordOrRecords);
        }
        else {
            records[existingIndex] = recordOrRecords;
        }
        await writeAll(records);
    }
    async function getById(attachmentId) {
        const records = await readAll();
        return records.find((record) => record.attachmentId === attachmentId) ?? null;
    }
    async function getBySavedPath(savedPath) {
        const records = await readAll();
        return records.find((record) => record.savedPath === savedPath) ?? null;
    }
    async function touch(attachmentId, lastReferencedAt) {
        return updateRecord((record) => record.attachmentId === attachmentId, (record) => ({
            ...record,
            lastReferencedAt,
        }));
    }
    async function touchBySavedPath(savedPath, lastReferencedAt) {
        return updateRecord((record) => record.savedPath === savedPath, (record) => ({
            ...record,
            lastReferencedAt,
        }));
    }
    async function appendThreadReference(attachmentId, threadId, lastReferencedAt) {
        return updateRecord((record) => record.attachmentId === attachmentId, (record) => ({
            ...record,
            threadIds: threadId && !record.threadIds.includes(threadId)
                ? [...record.threadIds, threadId]
                : record.threadIds,
            lastReferencedAt,
        }));
    }
    return {
        save,
        load: readAll,
        getById,
        getBySavedPath,
        touch,
        touchBySavedPath,
        appendThreadReference,
    };
}
//# sourceMappingURL=attachment-metadata-store.js.map