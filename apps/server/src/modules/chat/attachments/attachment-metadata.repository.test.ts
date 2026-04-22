import test from 'node:test';
import assert from 'node:assert/strict';

import { createAttachmentMetadataRepository } from './attachment-metadata.repository.js';

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

test('attachment metadata repository serializes concurrent record saves so uploads do not lose metadata', async () => {
  let records = [];
  const repository = createAttachmentMetadataRepository({
    store: {
      async load() {
        return records.map(record => ({ ...record }));
      },
      async save(record) {
        const snapshot = records.map(entry => ({ ...entry }));
        await wait(10);
        const nextRecords = Array.isArray(record) ? record : [...snapshot, record];
        records = nextRecords.map(entry => ({ ...entry }));
      },
      async getById(attachmentId) {
        return records.find(record => record.attachmentId === attachmentId) ?? null;
      },
      async getBySavedPath(savedPath) {
        return records.find(record => record.savedPath === savedPath) ?? null;
      },
      async touch() {},
      async touchBySavedPath() {},
      async appendThreadReference() {
        return null;
      },
    },
  });

  await Promise.all([
    repository.save({ attachmentId: 'att-1', savedPath: 'C:/tmp/att-1.webp' }),
    repository.save({ attachmentId: 'att-2', savedPath: 'C:/tmp/att-2.webp' }),
  ]);

  assert.deepEqual(await repository.load(), [
    { attachmentId: 'att-1', savedPath: 'C:/tmp/att-1.webp' },
    { attachmentId: 'att-2', savedPath: 'C:/tmp/att-2.webp' },
  ]);
});
