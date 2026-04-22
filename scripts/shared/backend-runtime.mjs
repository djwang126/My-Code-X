import path from 'node:path';

export function resolveBackendDistEntry(repoRoot) {
  return path.join(repoRoot, 'apps', 'server', 'dist', 'app', 'index.js');
}

export async function buildBackendRuntime({ runCommand, npmCommand }) {
  await runCommand(npmCommand, ['run', 'build:shared']);
  await runCommand(npmCommand, ['run', 'build', '--workspace', 'apps/server']);
}
