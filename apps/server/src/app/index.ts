import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { applyEnvFileToEnv } from '@my-code-x/utils/env-file';
import { loadMyCodeXUserEnv } from '@my-code-x/utils/my-code-x-user-env';
import { ensureMyCodeXCustomHarness } from '@my-code-x/utils/my-code-x-user-harness';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');

loadMyCodeXUserEnv({
  installRoot: repoRoot,
  userDir: process.env.MY_CODE_X_USER_DIR || '',
});
await ensureMyCodeXCustomHarness({
  installRoot: repoRoot,
  userDir: process.env.MY_CODE_X_USER_DIR || '',
});
applyEnvFileToEnv({
  filePath: path.join(repoRoot, '.env'),
});

const [
  {
    authToken,
    codexBin,
    codexIdleShutdownConfig,
    codexWorkingDir,
    frontendDistDir,
    host,
    port,
    serverInstanceId,
  },
  { startServer },
] = await Promise.all([import('../config/config.js'), import('./server.js')]);

let shuttingDown = false;

try {
  const started = await startServer({
    host,
    port,
    authToken,
    serverInstanceId,
    frontendDistDir,
    codexCommand: codexBin,
    codexWorkingDir,
    idleShutdownConfig: codexIdleShutdownConfig,
  });

  process.stdout.write(`apps/server listening on http://${host}:${port}\n`);

  async function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    await started.close();
  }

  function handleShutdown() {
    shutdown().finally(() => process.exit(0));
  }

  process.once('SIGINT', () => {
    handleShutdown();
  });

  process.once('SIGTERM', () => {
    handleShutdown();
  });

  if (process.env.MY_CODE_X_SHUTDOWN_ON_STDIN_END === '1') {
    process.stdin.resume();
    process.stdin.once('end', handleShutdown);
    process.stdin.once('close', handleShutdown);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
