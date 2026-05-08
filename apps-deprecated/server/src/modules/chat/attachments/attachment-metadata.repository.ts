import { createAttachmentMetadataStore } from './attachment-metadata-store.js';
export function createAttachmentMetadataRepository({ metadataPath = '', store = createAttachmentMetadataStore({ metadataPath }), }: any) {
    let writeQueue: Promise<unknown> = Promise.resolve();
    function enqueueWrite<T>(writeOperation: () => Promise<T>) {
        const nextWrite = writeQueue.then(writeOperation);
        writeQueue = nextWrite.catch(() => { });
        return nextWrite;
    }
    return {
        load() {
            return store.load();
        },
        save(recordOrRecords: any) {
            return enqueueWrite(() => store.save(recordOrRecords));
        },
        getById(attachmentId: any) {
            return store.getById(attachmentId);
        },
        getBySavedPath(savedPath: any) {
            return store.getBySavedPath(savedPath);
        },
        touch(attachmentId: any, lastReferencedAt: any) {
            return enqueueWrite(() => store.touch(attachmentId, lastReferencedAt));
        },
        touchBySavedPath(savedPath: any, lastReferencedAt: any) {
            return enqueueWrite(() => store.touchBySavedPath(savedPath, lastReferencedAt));
        },
        appendThreadReference(attachmentId: any, threadId: any, lastReferencedAt: any) {
            return enqueueWrite(() => store.appendThreadReference(attachmentId, threadId, lastReferencedAt));
        },
    };
}
