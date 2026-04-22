import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';

async function loadModule() {
  return import('./attachment-processing.service.js');
}

async function withTempDir(run) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'my-code-x-attachment-processing-'));
  try {
    await run(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

interface ImageAdapterOverrides {
  inspectResult?: {
    width: number;
    height: number;
    hasTransparency: boolean;
    orientation: number;
    byteLength: number;
  };
  normalizeAndEncodeResult?: {
    outputBuffer: Buffer;
    contentType: string;
    width: number;
    height: number;
    byteLength: number;
    codec: string;
    quality: number | null;
    metadataStripped: boolean;
  };
  reencodeWithinLimit?: (input: any) => Promise<{
    outputBuffer: Buffer;
    contentType: string;
    width: number;
    height: number;
    byteLength: number;
    codec: string;
    quality: number | null;
    metadataStripped: boolean;
  }>;
}

function createImageAdapter(records, overrides: ImageAdapterOverrides = {}) {
  return {
    async inspect(filePath) {
      records.push({ type: 'inspect', filePath });
      return overrides.inspectResult ?? { width: 4032, height: 3024, hasTransparency: false, orientation: 6, byteLength: 5_500_000 };
    },
    async normalizeAndEncode(input) {
      records.push({ type: 'normalizeAndEncode', input });
      return (
        overrides.normalizeAndEncodeResult ?? {
          outputBuffer: Buffer.from('normalized-large-image'),
          contentType: 'image/jpeg',
          width: input.targetWidth,
          height: input.targetHeight,
          byteLength: 1_250_000,
          codec: 'jpeg',
          quality: 85,
          metadataStripped: true,
        }
      );
    },
    async reencodeWithinLimit(input) {
      records.push({ type: 'reencodeWithinLimit', input });
      if (typeof overrides.reencodeWithinLimit === 'function') {
        return overrides.reencodeWithinLimit(input);
      }
      return {
        outputBuffer: Buffer.from('reencoded-image'),
        contentType: 'image/jpeg',
        width: input.targetWidth,
        height: input.targetHeight,
        byteLength: 1_700_000,
        codec: 'jpeg',
        quality: 80,
        metadataStripped: true,
      };
    },
  };
}

test('attachment processing normalizes EXIF orientation, constrains the longest edge to 1600px, and skips recompression for already-small images', async () => {
  const { createAttachmentProcessingService } = await loadModule();

  await withTempDir(async tempDir => {
    const records = [];
    const sourcePath = path.join(tempDir, 'source-orientation-6.jpg');
    const alreadySmallPath = path.join(tempDir, 'already-small.png');
    const outputRoot = path.join(tempDir, 'attachments');
    await mkdir(outputRoot, { recursive: true });
    await writeFile(sourcePath, Buffer.from('raw-large-image'));
    await writeFile(alreadySmallPath, Buffer.from('raw-small-image'));

    const service = createAttachmentProcessingService({
      outputRoot,
      imageAdapter: createImageAdapter(records, {
        inspectResult: { width: 4032, height: 3024, hasTransparency: false, orientation: 6, byteLength: 5_500_000 },
      }),
      logger: { info() {}, warn() {}, error() {} },
      randomId: () => 'att-large',
    });

    const result = await service.processAttachment({
      sourcePath,
      originalFilename: 'camera.jpg',
      contentType: 'image/jpeg',
    });

    assert.match(result.savedPath, /att-large/i);
    assert.equal(path.isAbsolute(result.savedPath), true);
    assert.equal(result.width, 1200);
    assert.equal(result.height, 1600);
    assert.equal(result.longestEdge, 1600);
    assert.equal(result.byteLength <= 2_000_000, true);
    assert.equal(result.contentType, 'image/jpeg');
    assert.equal(result.metadataStripped, true);
    assert.equal(records.some(entry => entry.type === 'normalizeAndEncode'), true);
    assert.equal(records.some(entry => entry.type === 'reencodeWithinLimit'), false);

    const alreadySmallRecords = [];
    const smallService = createAttachmentProcessingService({
      outputRoot,
      imageAdapter: createImageAdapter(alreadySmallRecords, {
        inspectResult: { width: 1200, height: 900, hasTransparency: false, orientation: 1, byteLength: 450_000 },
        normalizeAndEncodeResult: {
          outputBuffer: Buffer.from('small-image-original'),
          contentType: 'image/png',
          width: 1200,
          height: 900,
          byteLength: 450_000,
          codec: 'png',
          quality: null,
          metadataStripped: true,
        },
      }),
      logger: { info() {}, warn() {}, error() {} },
      randomId: () => 'att-small',
    });

    const smallResult = await smallService.processAttachment({
      sourcePath: alreadySmallPath,
      originalFilename: 'already-small.png',
      contentType: 'image/png',
    });

    assert.equal(smallResult.width, 1200);
    assert.equal(smallResult.height, 900);
    assert.equal(smallResult.byteLength, 450_000);
    assert.equal(
      alreadySmallRecords.some(entry => entry.type === 'normalizeAndEncode' && entry.input.shouldNormalize === false),
      true,
    );
    assert.equal(alreadySmallRecords.some(entry => entry.type === 'reencodeWithinLimit'), false);
  });
});

test('attachment processing preserves transparency, retries one lower-quality pass when still above 2MB, and then fails clearly if still too large', async () => {
  const { createAttachmentProcessingService } = await loadModule();

  await withTempDir(async tempDir => {
    const sourcePath = path.join(tempDir, 'diagram.png');
    const outputRoot = path.join(tempDir, 'attachments');
    await mkdir(outputRoot, { recursive: true });
    await writeFile(sourcePath, Buffer.from('raw-transparent-image'));

    const successRecords = [];
    const successService = createAttachmentProcessingService({
      outputRoot,
      imageAdapter: createImageAdapter(successRecords, {
        inspectResult: { width: 2400, height: 1800, hasTransparency: true, orientation: 1, byteLength: 3_900_000 },
        normalizeAndEncodeResult: {
          outputBuffer: Buffer.from('first-pass-still-too-large'),
          contentType: 'image/webp',
          width: 1600,
          height: 1200,
          byteLength: 2_300_000,
          codec: 'webp',
          quality: 92,
          metadataStripped: true,
        },
        reencodeWithinLimit: async () => ({
          outputBuffer: Buffer.from('second-pass-fit'),
          contentType: 'image/webp',
          width: 1600,
          height: 1200,
          byteLength: 1_850_000,
          codec: 'webp',
          quality: 88,
          metadataStripped: true,
        }),
      }),
      logger: { info() {}, warn() {}, error() {} },
      randomId: () => 'att-transparent',
    });

    const successResult = await successService.processAttachment({
      sourcePath,
      originalFilename: 'diagram.png',
      contentType: 'image/png',
    });

    assert.equal(successResult.contentType, 'image/webp');
    assert.equal(successResult.byteLength, 1_850_000);
    assert.equal(successRecords.filter(entry => entry.type === 'reencodeWithinLimit').length, 1);

    const failService = createAttachmentProcessingService({
      outputRoot,
      imageAdapter: createImageAdapter([], {
        inspectResult: { width: 2400, height: 1800, hasTransparency: true, orientation: 1, byteLength: 7_900_000 },
        normalizeAndEncodeResult: {
          outputBuffer: Buffer.from('first-pass-too-large'),
          contentType: 'image/webp',
          width: 1600,
          height: 1200,
          byteLength: 2_700_000,
          codec: 'webp',
          quality: 92,
          metadataStripped: true,
        },
        reencodeWithinLimit: async () => ({
          outputBuffer: Buffer.from('second-pass-still-too-large'),
          contentType: 'image/webp',
          width: 1600,
          height: 1200,
          byteLength: 2_400_000,
          codec: 'webp',
          quality: 88,
          metadataStripped: true,
        }),
      }),
      logger: { info() {}, warn() {}, error() {} },
      randomId: () => 'att-too-large',
    });

    await assert.rejects(
      () =>
        failService.processAttachment({
          sourcePath,
          originalFilename: 'diagram-too-large.png',
          contentType: 'image/png',
        }),
      error => {
        const typedError = error as { code?: string; statusCode?: number };
        assert.equal(typedError.code, 'attachment_too_large_after_compression');
        assert.equal(typedError.statusCode, 413);
        return true;
      },
    );
  });
});

test('attachment processing records structured compression results without logging raw image bytes', async () => {
  const { createAttachmentProcessingService } = await loadModule();

  await withTempDir(async tempDir => {
    const sourcePath = path.join(tempDir, 'camera.jpg');
    const outputRoot = path.join(tempDir, 'attachments');
    const loggerCalls = [];
    await mkdir(outputRoot, { recursive: true });
    await writeFile(sourcePath, Buffer.from('raw-image-for-logging'));

    const service = createAttachmentProcessingService({
      outputRoot,
      imageAdapter: createImageAdapter([], {
        inspectResult: { width: 3000, height: 2000, hasTransparency: false, orientation: 1, byteLength: 3_100_000 },
        normalizeAndEncodeResult: {
          outputBuffer: Buffer.from('saved-image'),
          contentType: 'image/jpeg',
          width: 1600,
          height: 1067,
          byteLength: 980_000,
          codec: 'jpeg',
          quality: 85,
          metadataStripped: true,
        },
      }),
      logger: {
        info(entry) {
          loggerCalls.push(entry);
        },
        warn() {},
        error() {},
      },
      randomId: () => 'att-log',
    });

    const result = await service.processAttachment({
      sourcePath,
      originalFilename: 'camera.jpg',
      contentType: 'image/jpeg',
    });

    assert.equal(path.isAbsolute(result.savedPath), true);
    const savedBuffer = await readFile(result.savedPath);
    assert.equal(savedBuffer.toString('utf8'), 'saved-image');

    assert.equal(loggerCalls.length, 2);
    assert.deepEqual(loggerCalls[0], {
      event: 'attachment_processing_decided',
      attachmentId: 'att-log',
      originalFilename: 'camera.jpg',
      sourceContentType: 'image/jpeg',
      byteLengthBefore: 3_100_000,
      widthBefore: 3000,
      heightBefore: 2000,
      targetWidth: 1600,
      targetHeight: 1067,
      hasTransparency: false,
      shouldNormalize: true,
      normalizationMode: 'canonical',
    });
    assert.deepEqual(loggerCalls[1], {
      event: 'attachment_processed',
      attachmentId: 'att-log',
      originalFilename: 'camera.jpg',
      savedPath: result.savedPath,
      contentType: 'image/jpeg',
      width: 1600,
      height: 1067,
      longestEdge: 1600,
      byteLengthBefore: 3_100_000,
      byteLengthAfter: 980_000,
      codec: 'jpeg',
      quality: 85,
      metadataStripped: true,
      normalizationMode: 'canonical',
      savingsBytes: 2_120_000,
    });
    assert.equal(JSON.stringify(loggerCalls[0]).includes('raw-image-for-logging'), false);
    assert.equal(JSON.stringify(loggerCalls[1]).includes('raw-image-for-logging'), false);
  });
});

test('attachment processing rejects invalid image payloads before compression begins', async () => {
  const { createAttachmentProcessingService } = await loadModule();

  await withTempDir(async tempDir => {
    const sourcePath = path.join(tempDir, 'invalid.png');
    const outputRoot = path.join(tempDir, 'attachments');
    await mkdir(outputRoot, { recursive: true });
    await writeFile(sourcePath, Buffer.from('not-a-real-image'));

    const service = createAttachmentProcessingService({
      outputRoot,
      imageAdapter: {
        async inspect() {
          throw new Error('Input buffer contains unsupported image format');
        },
      },
      logger: { info() {}, warn() {}, error() {} },
      randomId: () => 'att-invalid',
    });

    await assert.rejects(
      () =>
        service.processAttachment({
          sourcePath,
          originalFilename: 'invalid.png',
          contentType: 'image/png',
        }),
      error => {
        const typedError = error as { code?: string; statusCode?: number };
        assert.equal(typedError.code, 'invalid_image_payload');
        assert.equal(typedError.statusCode, 400);
        return true;
      },
    );
  });
});

test('attachment processing rejects images whose decoded pixel count exceeds the safety cap', async () => {
  const { createAttachmentProcessingService } = await loadModule();

  await withTempDir(async tempDir => {
    const sourcePath = path.join(tempDir, 'huge.png');
    const outputRoot = path.join(tempDir, 'attachments');
    await mkdir(outputRoot, { recursive: true });
    await writeFile(sourcePath, Buffer.from('oversized-image'));

    const service = createAttachmentProcessingService({
      outputRoot,
      imageAdapter: {
        async inspect() {
          return {
            width: 10000,
            height: 5000,
            hasTransparency: false,
            orientation: 1,
            byteLength: 8_500_000,
          };
        },
      },
      logger: { info() {}, warn() {}, error() {} },
      randomId: () => 'att-huge',
    });

    await assert.rejects(
      () =>
        service.processAttachment({
          sourcePath,
          originalFilename: 'huge.png',
          contentType: 'image/png',
        }),
      error => {
        const typedError = error as { code?: string; statusCode?: number };
        assert.equal(typedError.code, 'attachment_pixel_limit_exceeded');
        assert.equal(typedError.statusCode, 413);
        return true;
      },
    );
  });
});
