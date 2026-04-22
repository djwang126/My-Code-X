import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';

async function loadModule() {
  return import('./attachment-storage.service.js');
}

async function withTempDir(run) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'my-code-x-attachment-storage-'));
  try {
    await run(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

test('attachment storage persists files under the app-owned root with absolute paths and stable metadata', async () => {
  const { createAttachmentStorageService } = await loadModule();

  await withTempDir(async tempDir => {
    const appDataRoot = path.join(tempDir, '.my-code-x');
    const workspaceRoot = path.join(tempDir, 'workspace');
    const sourcePath = path.join(tempDir, 'incoming.webp');
    const metadataWrites = [];

    await mkdir(appDataRoot, { recursive: true });
    await mkdir(workspaceRoot, { recursive: true });
    await writeFile(sourcePath, Buffer.from('compressed-image'));

    const metadataStore = {
      async save(record) {
        metadataWrites.push(record);
      },
    };

    const service = createAttachmentStorageService({
      appDataRoot,
      metadataStore,
      now: () => new Date('2026-04-15T10:00:00.000Z'),
      randomId: () => 'att-20260415-1',
      hashFile: async () => 'sha256:abc123',
    });

    const result = await service.persistProcessedAttachment({
      viewerId: 'viewer-1',
      threadId: 'thread-1',
      workspaceRoot,
      originalFilename: 'screen.webp',
      processedFile: {
        sourcePath,
        contentType: 'image/webp',
        width: 1600,
        height: 900,
        byteLength: 765_432,
      },
    });

    assert.equal(path.isAbsolute(result.savedPath), true);
    assert.equal(result.savedPath.startsWith(appDataRoot), true);
    assert.equal(result.savedPath.startsWith(workspaceRoot), false);
    assert.match(result.savedPath, /attachments[\\/]+2026[\\/]+04[\\/]+15[\\/]+att-20260415-1/i);
    assert.deepEqual(metadataWrites, [
      {
        attachmentId: 'att-20260415-1',
        viewerId: 'viewer-1',
        threadIds: ['thread-1'],
        savedPath: result.savedPath,
        originalFilename: 'screen.webp',
        contentHash: 'sha256:abc123',
        contentType: 'image/webp',
        width: 1600,
        height: 900,
        byteLength: 765_432,
        createdAt: '2026-04-15T10:00:00.000Z',
        lastReferencedAt: '2026-04-15T10:00:00.000Z',
      },
    ]);

    const savedBytes = await readFile(result.savedPath);
    assert.equal(savedBytes.toString('utf8'), 'compressed-image');
  });
});
