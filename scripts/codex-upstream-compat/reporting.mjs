import fsp from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { reportRoot } from './constants.mjs';
import { ensureDir } from './fs-utils.mjs';

export async function writeReport(report, destinationPath = path.join(reportRoot, 'latest-report.json')) {
  await ensureDir(path.dirname(destinationPath));
  await fsp.writeFile(destinationPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function summarizeSchemaResult(schemaResult) {
  if (schemaResult.status === 'pass') {
    return `PASS  tracked schema surface matches (${schemaResult.currentCodexVersion})`;
  }

  if (!schemaResult.snapshotMetadata) {
    return 'FAIL  tracked schema snapshot is missing';
  }

  if (schemaResult.summary === 'Schema snapshot is incomplete for the tracked Codex surface.') {
    return `FAIL  tracked schema snapshot is incomplete (${schemaResult.currentCodexVersion})`;
  }

  if (schemaResult.summary?.startsWith('Used-surface manifest')) {
    return 'FAIL  tracked schema manifest is invalid';
  }

  return `FAIL  tracked schema drift detected (${schemaResult.currentCodexVersion})`;
}

export function printSchemaResult(schemaResult) {
  process.stdout.write(`${summarizeSchemaResult(schemaResult)}\n`);
  if (schemaResult.snapshotMetadata) {
    process.stdout.write(`      snapshot: ${schemaResult.snapshotMetadata.codexVersion}\n`);
    process.stdout.write(`      current : ${schemaResult.currentCodexVersion}\n`);
  }

  for (const mode of schemaResult.modes || []) {
    const diffSummary = [];
    if (mode.diff?.added?.length) diffSummary.push(`added ${mode.diff.added.length}`);
    if (mode.diff?.removed?.length) diffSummary.push(`removed ${mode.diff.removed.length}`);
    if (mode.diff?.changed?.length) diffSummary.push(`changed ${mode.diff.changed.length}`);
    const detailText = mode.error ? ` (${mode.error})` : diffSummary.length ? ` (${diffSummary.join(', ')})` : '';
    process.stdout.write(
      `      ${mode.mode}: ${mode.status.toUpperCase()} [tracked ${mode.trackedFileCount ?? 0}]${detailText}\n`,
    );
  }
}
