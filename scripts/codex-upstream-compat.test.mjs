import test from 'node:test';
import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { checkSchemas, loadUsedSurfaceManifest } from './codex-upstream-compat.mjs';

async function makeTempDir(prefix) {
  return fsp.mkdtemp(path.join(os.tmpdir(), prefix));
}

function createTestManifest() {
  return {
    description: 'Test manifest',
    modes: {
      stable: {
        files: ['tracked.json'],
      },
      experimental: {
        files: ['tracked.json'],
      },
    },
  };
}

async function writeSnapshotMetadata(snapshotDir) {
  await fsp.writeFile(
    path.join(snapshotDir, 'metadata.json'),
    `${JSON.stringify(
      {
        codexVersion: 'codex-cli test',
        generatedAt: '2026-04-13T00:00:00.000Z',
        modes: ['stable', 'experimental'],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

function formatJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

test('loadUsedSurfaceManifest rejects a manifest without tracked files for each mode', async () => {
  const manifestDir = await makeTempDir('codex-upstream-compat-manifest-');
  const manifestPath = path.join(manifestDir, 'used-surface.json');
  await fsp.writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        modes: {
          stable: { files: ['v2/ThreadStartParams.json'] },
          experimental: { files: [] },
        },
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  const result = await loadUsedSurfaceManifest(manifestPath);
  assert.equal(result.status, 'fail');
  assert.equal(result.summary, 'Used-surface manifest is missing tracked files for experimental.');
});

test('checkSchemas returns a structured failure when a snapshot mode directory is missing', async () => {
  const snapshotDir = await makeTempDir('codex-upstream-compat-missing-');
  await writeSnapshotMetadata(snapshotDir);
  await fsp.mkdir(path.join(snapshotDir, 'stable'), { recursive: true });
  await fsp.writeFile(path.join(snapshotDir, 'stable', 'tracked.json'), '{}\n', 'utf8');

  const result = await checkSchemas({
    codexBin: 'codex',
    snapshotDir,
    usedSurfaceManifest: createTestManifest(),
    getCodexVersionImpl: async () => 'codex-cli test-current',
    generateSchemaBundleImpl: async () => {
      throw new Error('generateSchemaBundleImpl should not be called for an incomplete snapshot');
    },
  });

  assert.equal(result.status, 'fail');
  assert.equal(result.summary, 'Schema snapshot is incomplete for the tracked Codex surface.');
  assert.equal(result.currentCodexVersion, 'codex-cli test-current');
  assert.equal(result.snapshotMetadata?.codexVersion, 'codex-cli test');
  assert.deepEqual(
    result.modes.map(mode => ({
      mode: mode.mode,
      status: mode.status,
      trackedFileCount: mode.trackedFileCount,
      error: mode.error || null,
    })),
    [
      {
        mode: 'stable',
        status: 'pass',
        trackedFileCount: 1,
        error: null,
      },
      {
        mode: 'experimental',
        status: 'fail',
        trackedFileCount: 1,
        error: 'snapshot directory is missing',
      },
    ],
  );
});

test('checkSchemas returns a structured failure when a tracked snapshot file is missing', async () => {
  const snapshotDir = await makeTempDir('codex-upstream-compat-missing-tracked-');
  await writeSnapshotMetadata(snapshotDir);
  await fsp.mkdir(path.join(snapshotDir, 'stable'), { recursive: true });
  await fsp.mkdir(path.join(snapshotDir, 'experimental'), { recursive: true });
  await fsp.writeFile(path.join(snapshotDir, 'stable', 'tracked.json'), '{}\n', 'utf8');
  await fsp.writeFile(path.join(snapshotDir, 'experimental', 'placeholder.json'), '{}\n', 'utf8');

  const result = await checkSchemas({
    codexBin: 'codex',
    snapshotDir,
    usedSurfaceManifest: createTestManifest(),
    getCodexVersionImpl: async () => 'codex-cli test-current',
    generateSchemaBundleImpl: async () => {
      throw new Error('generateSchemaBundleImpl should not be called for an incomplete snapshot');
    },
  });

  assert.equal(result.status, 'fail');
  assert.equal(result.summary, 'Schema snapshot is incomplete for the tracked Codex surface.');
  assert.equal(
    result.modes.find(mode => mode.mode === 'experimental')?.error,
    'tracked snapshot files are missing: tracked.json',
  );
});

test('checkSchemas ignores drift outside the tracked surface', async () => {
  const snapshotDir = await makeTempDir('codex-upstream-compat-tracked-only-');
  const generatedStableDir = await makeTempDir('codex-generated-stable-');
  const generatedExperimentalDir = await makeTempDir('codex-generated-experimental-');
  await writeSnapshotMetadata(snapshotDir);

  for (const mode of ['stable', 'experimental']) {
    await fsp.mkdir(path.join(snapshotDir, mode), { recursive: true });
    await fsp.writeFile(path.join(snapshotDir, mode, 'tracked.json'), formatJson({ version: 'baseline' }), 'utf8');
    await fsp.writeFile(path.join(snapshotDir, mode, 'untracked.json'), formatJson({ version: 'baseline' }), 'utf8');
  }

  await fsp.writeFile(path.join(generatedStableDir, 'tracked.json'), formatJson({ version: 'baseline' }), 'utf8');
  await fsp.writeFile(path.join(generatedStableDir, 'untracked.json'), formatJson({ version: 'changed' }), 'utf8');
  await fsp.writeFile(path.join(generatedExperimentalDir, 'tracked.json'), formatJson({ version: 'baseline' }), 'utf8');
  await fsp.writeFile(path.join(generatedExperimentalDir, 'untracked.json'), formatJson({ version: 'changed' }), 'utf8');

  const result = await checkSchemas({
    codexBin: 'codex',
    snapshotDir,
    usedSurfaceManifest: createTestManifest(),
    getCodexVersionImpl: async () => 'codex-cli test-current',
    generateSchemaBundleImpl: async ({ experimental }) => (experimental ? generatedExperimentalDir : generatedStableDir),
  });

  assert.equal(result.status, 'pass');
  assert.equal(result.summary, 'Generated tracked Codex surface matches the committed snapshot.');
  assert.deepEqual(
    result.modes.map(mode => ({
      mode: mode.mode,
      status: mode.status,
      trackedFileCount: mode.trackedFileCount,
      diff: mode.diff,
    })),
    [
      {
        mode: 'stable',
        status: 'pass',
        trackedFileCount: 1,
        diff: {
          added: [],
          removed: [],
          changed: [],
        },
      },
      {
        mode: 'experimental',
        status: 'pass',
        trackedFileCount: 1,
        diff: {
          added: [],
          removed: [],
          changed: [],
        },
      },
    ],
  );
});

test('checkSchemas ignores CRLF-only drift in tracked snapshot files', async () => {
  const snapshotDir = await makeTempDir('codex-upstream-compat-crlf-');
  const generatedStableDir = await makeTempDir('codex-generated-stable-crlf-');
  const generatedExperimentalDir = await makeTempDir('codex-generated-experimental-crlf-');
  await writeSnapshotMetadata(snapshotDir);

  for (const mode of ['stable', 'experimental']) {
    await fsp.mkdir(path.join(snapshotDir, mode), { recursive: true });
    await fsp.writeFile(
      path.join(snapshotDir, mode, 'tracked.json'),
      formatJson({ nested: { value: 1 } }).replaceAll('\n', '\r\n'),
      'utf8',
    );
  }

  await fsp.writeFile(path.join(generatedStableDir, 'tracked.json'), formatJson({ nested: { value: 1 } }), 'utf8');
  await fsp.writeFile(path.join(generatedExperimentalDir, 'tracked.json'), formatJson({ nested: { value: 1 } }), 'utf8');

  const result = await checkSchemas({
    codexBin: 'codex',
    snapshotDir,
    usedSurfaceManifest: createTestManifest(),
    getCodexVersionImpl: async () => 'codex-cli test-current',
    generateSchemaBundleImpl: async ({ experimental }) => (experimental ? generatedExperimentalDir : generatedStableDir),
  });

  assert.equal(result.status, 'pass');
  assert.equal(result.summary, 'Generated tracked Codex surface matches the committed snapshot.');
});
