import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
function isMissingFileError(error: any) {
    return Boolean(error && typeof error === 'object' && error.code === 'ENOENT');
}
export function createAttachmentMetadataStore({ metadataPath }: any) {
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
    async function writeAll(records: any) {
        await mkdir(path.dirname(metadataPath), { recursive: true });
        await writeFile(metadataPath, JSON.stringify(records, null, 2));
    }
    async function updateRecord(predicate: any, updater: any) {
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
    async function save(recordOrRecords: any) {
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
    async function getById(attachmentId: any) {
        const records = await readAll();
        return records.find((record: any) => record.attachmentId === attachmentId) ?? null;
    }
    async function getBySavedPath(savedPath: any) {
        const records = await readAll();
        return records.find((record: any) => record.savedPath === savedPath) ?? null;
    }
    async function touch(attachmentId: any, lastReferencedAt: any) {
        return updateRecord((record: any) => record.attachmentId === attachmentId, (record: any) => ({
            ...record,
            lastReferencedAt,
        }));
    }
    async function touchBySavedPath(savedPath: any, lastReferencedAt: any) {
        return updateRecord((record: any) => record.savedPath === savedPath, (record: any) => ({
            ...record,
            lastReferencedAt,
        }));
    }
    async function appendThreadReference(attachmentId: any, threadId: any, lastReferencedAt: any) {
        return updateRecord((record: any) => record.attachmentId === attachmentId, (record: any) => ({
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
