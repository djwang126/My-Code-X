import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';

import sharp from 'sharp';

import { createSharpImageAdapter } from './sharp-image-adapter.js';

async function withTempDir(run) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'my-code-x-sharp-image-adapter-'));
  try {
    await run(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

test('sharp image adapter preserves a small png without forcing it through the lossy jpeg profile', async () => {
  await withTempDir(async tempDir => {
    const sourcePath = path.join(tempDir, 'small-diagram.png');
    await sharp({
      create: {
        width: 24,
        height: 24,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .png()
      .toFile(sourcePath);

    const adapter = createSharpImageAdapter();
    const result = await adapter.normalizeAndEncode({
      sourcePath,
      contentType: 'image/png',
      hasTransparency: false,
      targetWidth: 24,
      targetHeight: 24,
      shouldNormalize: false,
      maxByteLength: 2_000_000,
    });

    assert.equal(result.contentType, 'image/png');
    assert.equal(result.codec, 'png');
    assert.equal(result.metadataStripped, true);
    assert.equal(result.width, 24);
    assert.equal(result.height, 24);
  });
});
