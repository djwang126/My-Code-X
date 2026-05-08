import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, writeFile, access, rm } from 'node:fs/promises';

async function loadModule() {
  return import('./attachment-retention.service.js');
}

async function withTempDir(run) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'my-code-x-attachment-retention-'));
  try {
    await run(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

test('attachment retention keeps files referenced by active thread history and prunes orphaned attachments', async () => {
  const { createAttachmentRetentionService } = await loadModule();

  await withTempDir(async tempDir => {
    const attachmentsRoot = path.join(tempDir, 'attachments');
    await mkdir(attachmentsRoot, { recursive: true });
    const keptFile = path.join(attachmentsRoot, 'kept.webp');
    const orphanedFile = path.join(attachmentsRoot, 'orphaned.webp');
    await writeFile(keptFile, 'kept');
    await writeFile(orphanedFile, 'orphaned');

    const metadataStore = {
      attachments: [
        {
          attachmentId: 'att-kept',
          savedPath: keptFile,
          threadIds: ['thread-active'],
          lastReferencedAt: '2026-04-15T10:00:00.000Z',
        },
        {
          attachmentId: 'att-orphaned',
          savedPath: orphanedFile,
          threadIds: [],
          lastReferencedAt: '2025-12-01T00:00:00.000Z',
        },
      ],
      saveCalls: [],
      async load() {
        return this.attachments.map(item => ({ ...item, threadIds: [...item.threadIds] }));
      },
      async save(nextAttachments) {
        this.saveCalls.push(nextAttachments);
        this.attachments = nextAttachments.map(item => ({ ...item, threadIds: [...item.threadIds] }));
      },
    };

    const service = createAttachmentRetentionService({
      metadataStore,
      now: () => new Date('2026-04-15T10:00:00.000Z'),
      logger: { info() {}, warn() {}, error() {} },
    });

    const result = await service.pruneExpiredAttachments();

    assert.deepEqual(result, {
      keptAttachmentIds: ['att-kept'],
      prunedAttachmentIds: ['att-orphaned'],
      missingAttachmentIds: [],
    });
    assert.equal(await fileExists(keptFile), true);
    assert.equal(await fileExists(orphanedFile), false);
    assert.deepEqual(metadataStore.attachments, [
      {
        attachmentId: 'att-kept',
        savedPath: keptFile,
        threadIds: ['thread-active'],
        lastReferencedAt: '2026-04-15T10:00:00.000Z',
      },
    ]);
  });
});

test('attachment retention tolerates missing files on disk and converges stale metadata safely', async () => {
  const { createAttachmentRetentionService } = await loadModule();

  await withTempDir(async tempDir => {
    const attachmentsRoot = path.join(tempDir, 'attachments');
    await mkdir(attachmentsRoot, { recursive: true });
    const stalePath = path.join(attachmentsRoot, 'missing.webp');
    const livePath = path.join(attachmentsRoot, 'live.webp');
    await writeFile(livePath, 'live');

    const warnings = [];
    const metadataStore = {
      attachments: [
        {
          attachmentId: 'att-missing',
          savedPath: stalePath,
          threadIds: [],
          lastReferencedAt: '2025-01-01T00:00:00.000Z',
        },
        {
          attachmentId: 'att-live',
          savedPath: livePath,
          threadIds: ['thread-retained'],
          lastReferencedAt: '2026-04-15T10:00:00.000Z',
        },
      ],
      async load() {
        return this.attachments.map(item => ({ ...item, threadIds: [...item.threadIds] }));
      },
      async save(nextAttachments) {
        this.attachments = nextAttachments.map(item => ({ ...item, threadIds: [...item.threadIds] }));
      },
    };

    const service = createAttachmentRetentionService({
      metadataStore,
      now: () => new Date('2026-04-15T10:00:00.000Z'),
      logger: {
        info() {},
        warn(entry) {
          warnings.push(entry);
        },
        error() {},
      },
    });

    const result = await service.pruneExpiredAttachments();

    assert.deepEqual(result, {
      keptAttachmentIds: ['att-live'],
      prunedAttachmentIds: [],
      missingAttachmentIds: ['att-missing'],
    });
    assert.equal(await fileExists(livePath), true);
    assert.deepEqual(metadataStore.attachments, [
      {
        attachmentId: 'att-live',
        savedPath: livePath,
        threadIds: ['thread-retained'],
        lastReferencedAt: '2026-04-15T10:00:00.000Z',
      },
    ]);
    assert.deepEqual(warnings, [
      {
        event: 'attachment_metadata_converged',
        attachmentId: 'att-missing',
        savedPath: stalePath,
        reason: 'file_missing_on_disk',
      },
    ]);
  });
});

test('attachment retention keeps thread-owned files even when no runtime is currently active for that thread', async () => {
  const { createAttachmentRetentionService } = await loadModule();

  await withTempDir(async tempDir => {
    const attachmentsRoot = path.join(tempDir, 'attachments');
    await mkdir(attachmentsRoot, { recursive: true });
    const historicalPath = path.join(attachmentsRoot, 'historical.webp');
    await writeFile(historicalPath, 'historical');

    const metadataStore = {
      attachments: [
        {
          attachmentId: 'att-historical',
          savedPath: historicalPath,
          threadIds: ['thread-historical'],
          lastReferencedAt: '2025-01-01T00:00:00.000Z',
        },
      ],
      async load() {
        return this.attachments.map(item => ({ ...item, threadIds: [...item.threadIds] }));
      },
      async save(nextAttachments) {
        this.attachments = nextAttachments.map(item => ({ ...item, threadIds: [...item.threadIds] }));
      },
    };

    const service = createAttachmentRetentionService({
      metadataStore,
      now: () => new Date('2026-04-15T10:00:00.000Z'),
      logger: { info() {}, warn() {}, error() {} },
    });

    const result = await service.pruneExpiredAttachments();

    assert.deepEqual(result, {
      keptAttachmentIds: ['att-historical'],
      prunedAttachmentIds: [],
      missingAttachmentIds: [],
    });
    assert.equal(await fileExists(historicalPath), true);
    assert.deepEqual(metadataStore.attachments, [
      {
        attachmentId: 'att-historical',
        savedPath: historicalPath,
        threadIds: ['thread-historical'],
        lastReferencedAt: '2025-01-01T00:00:00.000Z',
      },
    ]);
  });
});
