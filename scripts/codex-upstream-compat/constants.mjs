import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const scriptPath = fileURLToPath(import.meta.url);
const __dirname = path.dirname(scriptPath);
export const repoRoot = path.resolve(__dirname, '..');
export const snapshotRoot = path.join(repoRoot, 'contracts', 'codex-app-server-schema');
export const usedSurfaceManifestPath = path.join(snapshotRoot, 'used-surface.json');
export const reportRoot = path.join(repoRoot, 'output', 'codex-upstream-compat');
export const schemaModes = [
  { key: 'stable', experimental: false },
  { key: 'experimental', experimental: true },
];
