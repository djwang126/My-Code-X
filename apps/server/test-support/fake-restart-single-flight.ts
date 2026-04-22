import fs from 'node:fs/promises';

const markerFilePath = process.env.WEB_CODEX_RESTART_MARKER_FILE || '';

if (markerFilePath) {
  await fs.appendFile(markerFilePath, 'spawned\n', 'utf8');
}

await new Promise(resolve => setTimeout(resolve, 1_000));
