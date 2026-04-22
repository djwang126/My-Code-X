import fsp from 'node:fs/promises';
import path from 'node:path';

import { schemaModes, snapshotRoot } from './constants.mjs';
import { copyNormalizedTree, ensureDir, normalizeGeneratedTree, readNormalizedJsonText } from './fs-utils.mjs';
import { loadUsedSurfaceManifest } from './manifest.mjs';
import { validateSnapshotState } from './snapshot-state.mjs';
import { generateSchemaBundle, getCodexVersion } from './codex-cli.mjs';

export async function snapshotSchemas({
  codexBin,
  snapshotDir = snapshotRoot,
  modes = schemaModes,
  getCodexVersionImpl = getCodexVersion,
  generateSchemaBundleImpl = generateSchemaBundle,
} = {}) {
  const codexVersion = await getCodexVersionImpl(codexBin);
  const generatedAt = new Date().toISOString();
  await ensureDir(snapshotDir);

  const modeResults = [];
  for (const mode of modes) {
    const generatedDir = await generateSchemaBundleImpl({ codexBin, experimental: mode.experimental, makeTempDir: ensureTempDir });
    const actualGeneratedDir = typeof generatedDir === 'string' ? generatedDir : generatedDir.outputDir;
    const normalizedDir = await normalizeGeneratedTree(actualGeneratedDir);
    const targetDir = path.join(snapshotDir, mode.key);
    await copyNormalizedTree(normalizedDir, targetDir);
    modeResults.push({
      mode: mode.key,
      snapshotPath: targetDir,
    });
  }

  const metadata = {
    codexVersion,
    generatedAt,
    modes: modes.map(mode => mode.key),
  };
  await fsp.writeFile(path.join(snapshotDir, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');

  return {
    status: 'pass',
    codexVersion,
    generatedAt,
    modes: modeResults,
  };
}

async function ensureTempDir(prefix) {
  const { mkdtemp } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  return mkdtemp(path.join(tmpdir(), prefix));
}

async function compareTrackedSchemaFiles(expectedDir, actualDir, trackedFiles) {
  const diff = {
    added: [],
    removed: [],
    changed: [],
  };

  for (const relativePath of trackedFiles) {
    const expectedPath = path.join(expectedDir, relativePath);
    const actualPath = path.join(actualDir, relativePath);

    let expectedContent;
    let actualContent;

    try {
      expectedContent = await readNormalizedJsonText(expectedPath);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        diff.added.push(relativePath);
        continue;
      }
      throw error;
    }

    try {
      actualContent = await readNormalizedJsonText(actualPath);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        diff.removed.push(relativePath);
        continue;
      }
      throw error;
    }

    if (expectedContent !== actualContent) {
      diff.changed.push(relativePath);
    }
  }

  return diff;
}

export async function checkSchemas({
  codexBin,
  snapshotDir = snapshotRoot,
  modes = schemaModes,
  usedSurfaceManifest = null,
  getCodexVersionImpl = getCodexVersion,
  generateSchemaBundleImpl = generateSchemaBundle,
  loadUsedSurfaceManifestImpl = loadUsedSurfaceManifest,
} = {}) {
  const currentCodexVersion = await getCodexVersionImpl(codexBin);
  const snapshotState = await validateSnapshotState({
    snapshotDir,
    modes,
    usedSurfaceManifest,
    loadUsedSurfaceManifestImpl,
  });

  if (snapshotState.status !== 'pass') {
    return {
      status: 'fail',
      summary: snapshotState.summary,
      modes: snapshotState.modes,
      usedSurfaceManifest: snapshotState.usedSurfaceManifest,
      snapshotMetadata: snapshotState.metadata,
      currentCodexVersion,
    };
  }

  const modeResults = [];
  for (const mode of modes) {
    const expectedDir = path.join(snapshotDir, mode.key);
    const trackedFiles = snapshotState.usedSurfaceManifest.modes[mode.key].files;

    try {
      const generatedDir = await generateSchemaBundleImpl({ codexBin, experimental: mode.experimental, makeTempDir: ensureTempDir });
      const actualGeneratedDir = typeof generatedDir === 'string' ? generatedDir : generatedDir.outputDir;
      const actualDir = await normalizeGeneratedTree(actualGeneratedDir);
      const diff = await compareTrackedSchemaFiles(expectedDir, actualDir, trackedFiles);
      const hasDiff = diff.added.length || diff.removed.length || diff.changed.length;

      modeResults.push({
        mode: mode.key,
        trackedFileCount: trackedFiles.length,
        status: hasDiff ? 'fail' : 'pass',
        diff,
      });
    } catch (error) {
      modeResults.push({
        mode: mode.key,
        trackedFileCount: trackedFiles.length,
        status: 'fail',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    status: modeResults.every(mode => mode.status === 'pass') ? 'pass' : 'fail',
    summary: modeResults.every(mode => mode.status === 'pass')
      ? 'Generated tracked Codex surface matches the committed snapshot.'
      : 'Generated tracked Codex surface differs from the committed snapshot.',
    modes: modeResults,
    usedSurfaceManifest: snapshotState.usedSurfaceManifest,
    snapshotMetadata: snapshotState.metadata,
    currentCodexVersion,
  };
}
