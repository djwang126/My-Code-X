import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { startServer } from '../src/app/server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const tsxLoaderPath = pathToFileURL(require.resolve('tsx')).href;
const fakeCodexAppServerPath = path.join(__dirname, 'fake-codex-app-server.ts');
const fakeRestartWaitScriptPath = path.join(__dirname, 'fake-restart-wait.ts');

let started;

try {
  started = await startServer({
    host: '127.0.0.1',
    port: 0,
    authToken: '',
    codexCommand: process.execPath,
    codexArgs: ['--import', tsxLoaderPath, fakeCodexAppServerPath],
    codexEnv: { FAKE_CODEX_SCENARIO: 'streaming_happy' },
    restartScript: fakeRestartWaitScriptPath,
  });

  const { port } = started.server.address();

  const restartResponse = await fetch(`http://127.0.0.1:${port}/api/v2/app/restart`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      viewerId: 'viewer-restart',
      slotId: 'tab-restart',
      workspace: 'D:/workspaces/My-Code-X',
      threadId: 'thread-restart',
    }),
  });

  if (restartResponse.status !== 200) {
    throw new Error(`unexpected restart status ${restartResponse.status}`);
  }

  await new Promise(resolve => setTimeout(resolve, 200));

  const healthResponse = await fetch(`http://127.0.0.1:${port}/api/health`);

  if (healthResponse.status !== 200) {
    throw new Error(`unexpected health status ${healthResponse.status}`);
  }

  await started.close();
  process.stdout.write('probe:pass\n');
  process.exitCode = 0;
} catch (error) {
  if (started) {
    await started.close().catch(() => {});
  }
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
}
