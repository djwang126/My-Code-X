import fsp from 'node:fs/promises';
import path from 'node:path';

import { schemaModes, snapshotRoot } from './constants.mjs';
import { collectRelativeFiles, normalizeRelativePath, readJsonFile } from './fs-utils.mjs';
import { loadUsedSurfaceManifest } from './manifest.mjs';

function describeMissingFiles(files, limit = 5) {
  if (!files.length) {
    return '';
  }

  const preview = files.slice(0, limit).join(', ');
  const remainder = files.length - Math.min(files.length, limit);
  return remainder > 0 ? `${preview} (+${remainder} more)` : preview;
}

async function describeSnapshotMode(snapshotDir, modeKey, trackedFiles) {
  const modeDir = path.join(snapshotDir, modeKey);

  try {
    const stat = await fsp.stat(modeDir);
    if (!stat.isDirectory()) {
      return {
        mode: modeKey,
        status: 'fail',
        trackedFileCount: trackedFiles.length,
        error: 'snapshot path is not a directory',
      };
    }

    const files = await collectRelativeFiles(modeDir);
    if (!files.length) {
      return {
        mode: modeKey,
        status: 'fail',
        trackedFileCount: trackedFiles.length,
        error: 'snapshot directory is empty',
      };
    }

    const fileSet = new Set(files.map(normalizeRelativePath));
    const missingTrackedFiles = trackedFiles.filter(file => !fileSet.has(file));

    if (missingTrackedFiles.length) {
      return {
        mode: modeKey,
        status: 'fail',
        trackedFileCount: trackedFiles.length,
        error: `tracked snapshot files are missing: ${describeMissingFiles(missingTrackedFiles)}`,
      };
    }

    return {
      mode: modeKey,
      status: 'pass',
      trackedFileCount: trackedFiles.length,
      snapshotPath: modeDir,
      fileCount: files.length,
    };
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return {
        mode: modeKey,
        status: 'fail',
        trackedFileCount: trackedFiles.length,
        error: 'snapshot directory is missing',
      };
    }

    return {
      mode: modeKey,
      status: 'fail',
      trackedFileCount: trackedFiles.length,
      error: `failed to inspect snapshot directory: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function validateSnapshotState({
  snapshotDir = snapshotRoot,
  modes = schemaModes,
  usedSurfaceManifest,
  loadUsedSurfaceManifestImpl = loadUsedSurfaceManifest,
} = {}) {
  const metadata = await readJsonFile(path.join(snapshotDir, 'metadata.json'));
  const surfaceManifestResult = usedSurfaceManifest
    ? { status: 'pass', manifest: usedSurfaceManifest }
    : await loadUsedSurfaceManifestImpl();

  if (surfaceManifestResult.status !== 'pass') {
    return {
      status: 'fail',
      summary: surfaceManifestResult.summary,
      metadata,
      usedSurfaceManifest: null,
      modes: modes.map(mode => ({
        mode: mode.key,
        status: 'fail',
        trackedFileCount: 0,
        error: surfaceManifestResult.summary,
      })),
    };
  }

  const modeStates = await Promise.all(
    modes.map(mode =>
      describeSnapshotMode(snapshotDir, mode.key, surfaceManifestResult.manifest.modes[mode.key]?.files ?? []),
    ),
  );

  if (!metadata) {
    return {
      status: 'fail',
      summary: 'Schema snapshot metadata is missing.',
      metadata: null,
      usedSurfaceManifest: surfaceManifestResult.manifest,
      modes: modeStates.map(modeState => ({
        ...modeState,
        status: 'fail',
        error: modeState.error || 'snapshot metadata is missing',
      })),
    };
  }

  if (modeStates.some(modeState => modeState.status !== 'pass')) {
    return {
      status: 'fail',
      summary: 'Schema snapshot is incomplete for the tracked Codex surface.',
      metadata,
      usedSurfaceManifest: surfaceManifestResult.manifest,
      modes: modeStates,
    };
  }

  return {
    status: 'pass',
    summary: 'Schema snapshot is complete for the tracked Codex surface.',
    metadata,
    usedSurfaceManifest: surfaceManifestResult.manifest,
    modes: modeStates,
  };
}
