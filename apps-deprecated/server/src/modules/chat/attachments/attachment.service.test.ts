import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';

import { createAttachmentService } from './attachment.service.js';

async function withTempDir(run) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'my-code-x-attachment-service-'));
  try {
    await run(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

test('attachment service refreshes attachment references when resolving display content and serving bytes', async () => {
  await withTempDir(async tempDir => {
    const savedPath = path.join(tempDir, 'att-1.webp');
    await mkdir(path.dirname(savedPath), { recursive: true });
    await writeFile(savedPath, Buffer.from('stored-image'));

    const touchedAttachmentIds = [];
    const touchedPaths = [];
    const metadataStore = {
      async getById(attachmentId) {
        return attachmentId === 'att-1'
          ? {
              attachmentId: 'att-1',
              viewerId: 'viewer-1',
              threadIds: ['thread-1'],
              savedPath,
              contentType: 'image/webp',
            }
          : null;
      },
      async getBySavedPath(inputPath) {
        return inputPath === savedPath
          ? {
              attachmentId: 'att-1',
              savedPath,
              contentType: 'image/webp',
            }
          : null;
      },
      async touch(attachmentId) {
        touchedAttachmentIds.push(attachmentId);
      },
      async touchBySavedPath(inputPath) {
        touchedPaths.push(inputPath);
      },
      async appendThreadReference() {
        throw new Error('appendThreadReference should not be called');
      },
      async save() {},
      async load() {
        return [];
      },
    };

    const service = createAttachmentService({
      appDataRoot: path.join(tempDir, '.my-code-x'),
      logger: { info() {}, warn() {}, error() {} },
      metadataStore,
      now: () => new Date('2026-04-16T03:00:00.000Z'),
      resolveSessionRuntime: () => ({
        viewerId: 'viewer-1',
        slotId: 'tab-1',
        threadId: 'thread-1',
      }),
    });

    const displayContent = await service.createDisplayContent([
      { type: 'imageAttachment', attachmentId: 'att-1' },
      { type: 'localImage', path: savedPath },
    ], { slotId: 'tab-1', threadId: 'thread-1' });
    const served = await service.getAttachmentContent({ attachmentId: 'att-1', slotId: 'tab-1', threadId: 'thread-1' });

    assert.deepEqual(displayContent, [
      {
        type: 'image',
        attachmentId: 'att-1',
        url: '/api/v2/chat/attachments/att-1/content?slotId=tab-1&threadId=thread-1',
      },
      {
        type: 'image',
        attachmentId: 'att-1',
        url: '/api/v2/chat/attachments/att-1/content?slotId=tab-1&threadId=thread-1',
      },
    ]);
    assert.equal(served.contentType, 'image/webp');
    assert.equal(served.body.toString('utf8'), 'stored-image');
    assert.deepEqual(touchedAttachmentIds, ['att-1', 'att-1']);
    assert.deepEqual(touchedPaths, [savedPath]);
  });
});

test('attachment service appends thread ownership after a successful send', async () => {
  const appendedReferences = [];
  const service = createAttachmentService({
    appDataRoot: path.join(os.tmpdir(), '.my-code-x-test'),
    logger: { info() {}, warn() {}, error() {} },
    metadataStore: {
      async getById() {
        return null;
      },
      async getBySavedPath() {
        return null;
      },
      async touch() {},
      async touchBySavedPath() {},
      async appendThreadReference(attachmentId, threadId, lastReferencedAt) {
        appendedReferences.push({ attachmentId, threadId, lastReferencedAt });
        return { attachmentId, threadId, lastReferencedAt };
      },
      async save() {},
      async load() {
        return [];
      },
    },
  });

  const result = await service.markAttachmentsReferenced({
    content: [
      { type: 'text', text: 'look at this' },
      { type: 'imageAttachment', attachmentId: 'att-1' },
      { type: 'imageAttachment', attachmentId: 'att-1' },
      { type: 'imageAttachment', attachmentId: 'att-2' },
    ],
    threadId: 'thread-22',
  });

  assert.equal(result.length, 2);
  assert.deepEqual(appendedReferences.map(entry => entry.attachmentId), ['att-1', 'att-2']);
  assert.equal(appendedReferences.every(entry => entry.threadId === 'thread-22'), true);
});

test('attachment service sanitizes uploaded filenames before writing temp files', async () => {
  const processingCalls = [];
  const service = createAttachmentService({
    appDataRoot: path.join(os.tmpdir(), '.my-code-x-test'),
    logger: { info() {}, warn() {}, error() {} },
    metadataStore: {
      async getById() {
        return null;
      },
      async getBySavedPath() {
        return null;
      },
      async touch() {},
      async touchBySavedPath() {},
      async appendThreadReference() {},
      async save() {},
      async load() {
        return [];
      },
    },
    processingService: {
      async processAttachment(input) {
        processingCalls.push(input);
        return {
          attachmentId: 'att-processed',
          savedPath: path.join(os.tmpdir(), 'att-processed.webp'),
          contentType: 'image/webp',
          width: 1200,
          height: 900,
          longestEdge: 1200,
          byteLength: 123_456,
          codec: 'webp',
          quality: 92,
          metadataStripped: true,
          normalizationMode: 'canonical',
        };
      },
    },
    storageService: {
      async persistProcessedAttachment() {
        return {
          attachmentId: 'att-processed',
          savedPath: path.join(os.tmpdir(), 'att-processed.webp'),
          contentType: 'image/webp',
          width: 1200,
          height: 900,
          byteLength: 123_456,
          workspaceRoot: '',
        };
      },
    },
  });

  await service.uploadAttachment({
    buffer: Buffer.from('image'),
    contentType: 'image/png',
    filename: '..\\..\\secret.png',
  });

  assert.equal(processingCalls.length, 1);
  assert.equal(processingCalls[0].originalFilename, 'secret.png');
  assert.equal(path.basename(processingCalls[0].sourcePath), 'secret.png');
});

test('attachment service rejects content reads when the active thread does not own the attachment', async () => {
  const service = createAttachmentService({
    appDataRoot: path.join(os.tmpdir(), '.my-code-x-test'),
    logger: { info() {}, warn() {}, error() {} },
    metadataStore: {
      async getById() {
        return {
          attachmentId: 'att-1',
          viewerId: 'viewer-1',
          threadIds: ['thread-allowed'],
          savedPath: path.join(os.tmpdir(), 'att-1.webp'),
          contentType: 'image/webp',
        };
      },
      async getBySavedPath() {
        return null;
      },
      async touch() {},
      async touchBySavedPath() {},
      async appendThreadReference() {
        return null;
      },
      async save() {},
      async load() {
        return [];
      },
    },
    resolveSessionRuntime: () => ({
      viewerId: 'viewer-1',
      slotId: 'tab-1',
      threadId: 'thread-denied',
    }),
  });

  await assert.rejects(
    () => service.getAttachmentContent({ attachmentId: 'att-1', slotId: 'tab-1', threadId: 'thread-denied' }),
    error => {
      const typedError = error as { statusCode?: number; code?: string };
      return typedError.statusCode === 403 && typedError.code === 'attachment_access_denied';
    },
  );
});

test('attachment service records structured logs when resolving attachment handoff paths', async () => {
  const infoLogs = [];
  const warnLogs = [];
  const service = createAttachmentService({
    appDataRoot: path.join(os.tmpdir(), '.my-code-x-test'),
    logger: {
      info(entry) {
        infoLogs.push(entry);
      },
      warn(entry) {
        warnLogs.push(entry);
      },
      error() {},
    },
    metadataStore: {
      async getById(attachmentId) {
        if (attachmentId === 'att-ready') {
          return {
            attachmentId: 'att-ready',
            savedPath: path.join(os.tmpdir(), 'att-ready.webp'),
            contentType: 'image/webp',
            viewerId: 'viewer-1',
            threadIds: ['thread-1'],
          };
        }

        return null;
      },
      async getBySavedPath() {
        return null;
      },
      async touch() {},
      async touchBySavedPath() {},
      async appendThreadReference() {
        return null;
      },
      async save() {},
      async load() {
        return [];
      },
    },
  });

  await assert.rejects(
    () =>
      service.resolveContent([
        { type: 'imageAttachment', attachmentId: 'att-ready' },
        { type: 'imageAttachment', attachmentId: 'att-missing' },
      ]),
    error => {
      const typedError = error as { statusCode?: number; code?: string };
      return typedError.statusCode === 404 && typedError.code === 'attachment_not_found';
    },
  );

  assert.deepEqual(infoLogs, [
    {
      event: 'attachment_handoff_resolved',
      attachmentId: 'att-ready',
      savedPath: path.join(os.tmpdir(), 'att-ready.webp'),
      contentType: 'image/webp',
    },
  ]);
  assert.deepEqual(warnLogs, [
    {
      event: 'attachment_handoff_failed',
      attachmentId: 'att-missing',
      reason: 'attachment_not_found',
    },
  ]);
});
