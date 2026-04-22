import process from 'node:process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { repoRoot } from './constants.mjs';

const execFileAsync = promisify(execFile);

export function parseArgs(argv, reportPath) {
  const [command = 'report'] = argv;
  return {
    command,
    codexBin: String(process.env.CODEX_BIN || 'codex').trim() || 'codex',
    reportPath,
  };
}

async function runCodexCommand(codexBin, args, options = {}) {
  const result = await execFileAsync(codexBin, args, {
    cwd: repoRoot,
    env: process.env,
    maxBuffer: 16 * 1024 * 1024,
    ...options,
  });

  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

export async function getCodexVersion(codexBin) {
  const { stdout, stderr } = await runCodexCommand(codexBin, ['--version']);
  return (stdout || stderr).trim();
}

export async function generateSchemaBundle({ codexBin, experimental, makeTempDir }) {
  const outputDir = await makeTempDir(`codex-schema-${experimental ? 'experimental' : 'stable'}-`);
  const args = ['app-server', 'generate-json-schema', '--out', outputDir];
  if (experimental) {
    args.push('--experimental');
  }

  await runCodexCommand(codexBin, args);
  return outputDir;
}
