import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { startCodexGateway } from './codex-gateway.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const tsxLoaderPath = pathToFileURL(require.resolve('tsx')).href;
const fakeCodexAppServerPath = path.join(__dirname, '..', '..', '..', 'test-support', 'fake-codex-app-server.ts');
const fakeCodexAppServerArgs = ['--import', tsxLoaderPath, fakeCodexAppServerPath];
const testWindowsOnly = process.platform === 'win32' ? test : test.skip;

function expectedPlainCodexWorkspaceCwd(workspace) {
  if (process.platform !== 'win32') {
    return workspace;
  }

  const trimmedWorkspace = String(workspace || '').trim();
  if (!trimmedWorkspace) {
    return trimmedWorkspace;
  }

  return trimmedWorkspace.replace(/\//g, '\\').replace(/\\+$/, '');
}

async function withGatewayForScenario({ scenario, workspace }, run) {
  const gateway = await startCodexGateway({
    command: process.execPath,
    args: fakeCodexAppServerArgs,
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      FAKE_CODEX_SCENARIO: scenario,
      FAKE_CODEX_EXPECTED_CWD: expectedPlainCodexWorkspaceCwd(workspace),
    },
  });

  try {
    await run(gateway);
  } finally {
    await gateway.close();
  }
}

test('listThreads stops after the plain Windows cwd query when the first query returns data', async () => {
  const workspace = 'D:/workspaces/Workspace One';

  await withGatewayForScenario({ scenario: 'workspace_cwd_query_plain_hit', workspace }, async gateway => {
    const threads = await gateway.listThreads({ workspace, limit: 5, archived: false });

    assert.deepEqual(threads, [
      {
        id: 'thr-history',
        name: 'History thread',
        preview: 'History works',
        workspace: expectedPlainCodexWorkspaceCwd(workspace),
        createdAt: 1730910000,
        updatedAt: 1730910100,
        statusText: 'idle',
      },
    ]);
  });
});

testWindowsOnly('listThreads falls back from a plain Windows cwd query to the extended form when the first query is empty', async () => {
  const workspace = 'D:/workspaces/Workspace One';

  await withGatewayForScenario({ scenario: 'workspace_cwd_query_fallback', workspace }, async gateway => {
    const threads = await gateway.listThreads({ workspace, limit: 5, archived: false });

    assert.deepEqual(threads, [
      {
        id: 'thr-history',
        name: 'History thread',
        preview: 'History works',
        workspace: expectedPlainCodexWorkspaceCwd(workspace),
        createdAt: 1730910000,
        updatedAt: 1730910100,
        statusText: 'idle',
      },
    ]);
  });
});

test('listThreads returns an empty list only after both Windows cwd query variants are empty', async () => {
  const workspace = 'D:/workspaces/Workspace One';

  await withGatewayForScenario({ scenario: 'workspace_cwd_query_empty', workspace }, async gateway => {
    const threads = await gateway.listThreads({ workspace, limit: 5, archived: false });
    assert.deepEqual(threads, []);
  });
});

test('listThreads preserves the first plain-path error instead of silently retrying alternate cwd variants', async () => {
  const workspace = 'D:/workspaces/Workspace One';

  await withGatewayForScenario({ scenario: 'workspace_cwd_query_plain_error', workspace }, async gateway => {
    await assert.rejects(
      gateway.listThreads({ workspace, limit: 5, archived: false }),
      error => error instanceof Error && error.message === 'thread/list plain query exploded',
    );
  });
});
