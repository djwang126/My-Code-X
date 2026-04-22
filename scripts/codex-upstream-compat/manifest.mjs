import { schemaModes, usedSurfaceManifestPath } from './constants.mjs';
import { normalizeRelativePath, readJsonFile } from './fs-utils.mjs';

function normalizeTrackedFileList(files) {
  const normalized = Array.isArray(files) ? files.map(normalizeRelativePath).filter(Boolean) : [];
  return [...new Set(normalized)].sort((left, right) => left.localeCompare(right));
}

export async function loadUsedSurfaceManifest(manifestPath = usedSurfaceManifestPath) {
  const manifest = await readJsonFile(manifestPath);
  if (!manifest || typeof manifest !== 'object') {
    return {
      status: 'fail',
      summary: 'Used-surface manifest is missing.',
      manifest: null,
    };
  }

  const modeEntries = manifest.modes && typeof manifest.modes === 'object' ? manifest.modes : null;
  if (!modeEntries) {
    return {
      status: 'fail',
      summary: 'Used-surface manifest is invalid.',
      manifest,
    };
  }

  const normalizedModes = {};
  for (const mode of schemaModes) {
    const modeEntry = modeEntries[mode.key];
    const files = normalizeTrackedFileList(modeEntry?.files);
    if (!files.length) {
      return {
        status: 'fail',
        summary: `Used-surface manifest is missing tracked files for ${mode.key}.`,
        manifest,
      };
    }

    normalizedModes[mode.key] = { files };
  }

  return {
    status: 'pass',
    summary: 'Used-surface manifest loaded.',
    manifest: {
      description: typeof manifest.description === 'string' ? manifest.description : '',
      modes: normalizedModes,
    },
  };
}
