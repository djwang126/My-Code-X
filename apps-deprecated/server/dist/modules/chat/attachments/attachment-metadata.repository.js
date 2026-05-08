import { createAttachmentMetadataStore } from './attachment-metadata-store.js';
export function createAttachmentMetadataRepository({ metadataPath = '', store = createAttachmentMetadataStore({ metadataPath }), }) {
    let writeQueue = Promise.resolve();
    function enqueueWrite(writeOperation) {
        const nextWrite = writeQueue.then(writeOperation);
        writeQueue = nextWrite.catch(() => { });
        return nextWrite;
    }
    return {
        load() {
            return store.load();
        },
        save(recordOrRecords) {
            return enqueueWrite(() => store.save(recordOrRecords));
        },
        getById(attachmentId) {
            return store.getById(attachmentId);
        },
        getBySavedPath(savedPath) {
            return store.getBySavedPath(savedPath);
        },
        touch(attachmentId, lastReferencedAt) {
            return enqueueWrite(() => store.touch(attachmentId, lastReferencedAt));
        },
        touchBySavedPath(savedPath, lastReferencedAt) {
            return enqueueWrite(() => store.touchBySavedPath(savedPath, lastReferencedAt));
        },
        appendThreadReference(attachmentId, threadId, lastReferencedAt) {
            return enqueueWrite(() => store.appendThreadReference(attachmentId, threadId, lastReferencedAt));
        },
    };
}
//# sourceMappingURL=attachment-metadata.repository.js.map