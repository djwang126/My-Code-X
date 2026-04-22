import path from 'node:path';
import process from 'node:process';

import { reportRoot, scriptPath, snapshotRoot } from './codex-upstream-compat/constants.mjs';
import { parseArgs } from './codex-upstream-compat/codex-cli.mjs';
import { loadUsedSurfaceManifest } from './codex-upstream-compat/manifest.mjs';
import { printSchemaResult, writeReport } from './codex-upstream-compat/reporting.mjs';
import { checkSchemas, snapshotSchemas } from './codex-upstream-compat/schema-ops.mjs';

async function main() {
  const args = parseArgs(process.argv.slice(2), path.join(reportRoot, 'latest-report.json'));

  if (args.command === 'snapshot-schema') {
    const result = await snapshotSchemas({ codexBin: args.codexBin });
    process.stdout.write(`Saved Codex app-server schema snapshot for ${result.codexVersion} to ${snapshotRoot}\n`);
    return;
  }

  if (args.command === 'check-schema') {
    const schemaResult = await checkSchemas({ codexBin: args.codexBin });
    printSchemaResult(schemaResult);
    if (schemaResult.status !== 'pass') {
      process.exitCode = 1;
    }
    return;
  }

  if (args.command !== 'report') {
    throw new Error(`Unknown command: ${args.command}`);
  }

  const schemaResult = await checkSchemas({ codexBin: args.codexBin });
  const report = {
    generatedAt: new Date().toISOString(),
    codexVersion: schemaResult.currentCodexVersion,
    schema: schemaResult,
  };

  await writeReport(report, args.reportPath);
  printSchemaResult(schemaResult);
  process.stdout.write(`      report : ${args.reportPath}\n`);

  if (schemaResult.status !== 'pass') {
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  await main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

export { checkSchemas, loadUsedSurfaceManifest, snapshotSchemas };
