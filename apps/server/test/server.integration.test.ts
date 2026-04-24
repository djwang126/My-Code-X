import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { startServer } from '../src/app/server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const tsxLoaderPath = pathToFileURL(require.resolve('tsx')).href;
const fakeCodexAppServerPath = path.join(__dirname, '..', 'test-support', 'fake-codex-app-server.ts');
const fakeCodexAppServerArgs = ['--import', tsxLoaderPath, fakeCodexAppServerPath];
const restartHandoffProbePath = path.join(__dirname, '..', 'test-support', 'restart-handoff-probe.ts');
const restartHandoffProbeArgs = ['--import', tsxLoaderPath, restartHandoffProbePath];
const fakeRestartSingleFlightScriptPath = path.join(__dirname, '..', 'test-support', 'fake-restart-single-flight.ts');
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

function createUserTimelineMessage({ threadId, turnId, text, content }) {
  return {
    id: `user:${turnId}`,
    kind: 'message',
    itemType: 'userMessage',
    role: 'user',
    text,
    state: 'complete',
    threadId,
    turnId,
    content,
    raw: {
      type: 'userMessage',
      id: `user:${turnId}`,
      content,
    },
  };
}

function createAssistantTimelineMessage({ threadId, turnId, text, raw = {} }) {
  return {
    id: `assistant:${turnId}`,
    kind: 'message',
    itemType: 'agentMessage',
    role: 'assistant',
    text,
    state: 'complete',
    threadId,
    turnId,
    raw: {
      type: 'agentMessage',
      id: `assistant:${turnId}`,
      text,
      ...raw,
    },
  };
}

async function withStartedServer(options, run) {
  const started = await startServer({
    host: '127.0.0.1',
    port: 0,
    authToken: '',
    codexCommand: process.execPath,
    codexArgs: fakeCodexAppServerArgs,
    ...options,
  });

  const { port } = started.server.address();

  try {
    await run({ port, started });
  } finally {
    await started.close();
  }
}

async function waitForFileContent({
  pathToRead,
  timeoutMs = 2_000,
  isReady = content => content.length > 0,
}) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const content = await fs.readFile(pathToRead, 'utf8');
      if (isReady(content)) {
        return content;
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    }

    await new Promise(resolve => setTimeout(resolve, 20));
  }

  const content = await fs.readFile(pathToRead, 'utf8');
  if (isReady(content)) {
    return content;
  }

  throw new Error(`timed out waiting for file content: ${pathToRead}`);
}

async function waitForLoggedRequests(pathToRead, expectedCount, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const content = await fs.readFile(pathToRead, 'utf8');
      const entries = content
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => JSON.parse(line));

      if (entries.length >= expectedCount) {
        return entries;
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    }

    await new Promise(resolve => setTimeout(resolve, 20));
  }

  const content = await fs.readFile(pathToRead, 'utf8');
  return content
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

function createTempCustomHarnessDir(tempRoot) {
  return path.join(tempRoot, '.My-Code-X', 'custom-harness');
}

test('real runtime startup forwards configured dynamic tools on thread/start', async () => {
  await withStartedServer(
    {
      codexEnv: { FAKE_CODEX_SCENARIO: 'dynamic_tool_thread_start' },
      codexDynamicTools: [
        {
          name: 'lookup_ticket',
          description: 'Fetch a ticket by id',
          deferLoading: true,
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
            },
            required: ['id'],
          },
        },
      ],
    },
    async ({ port }) => {
      const sendResponse = await fetch(`http://127.0.0.1:${port}/api/v2/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          viewerId: 'viewer-dynamic',
          slotId: 'tab-dynamic',
          text: 'Use the configured tool',
        }),
      });

      assert.equal(sendResponse.status, 200);
      assert.deepEqual(await sendResponse.json(), {
        threadId: 'thr-dynamic-tools',
        latestTurn: {
        id: 'turn-stream',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
        stream: {
          url: '/api/v2/chat/events?slotId=tab-dynamic&threadId=thr-dynamic-tools',
        },
      });
    },
  );
});

test('real runtime startup can restore an existing thread through thread/resume', async () => {
  await withStartedServer(
    {
      codexEnv: { FAKE_CODEX_SCENARIO: 'resume_thread' },
    },
    async ({ port }) => {
      const response = await fetch(
        `http://127.0.0.1:${port}/api/v2/session?viewerId=viewer-2&slotId=tab-2&threadId=thr-resume`,
      );

      assert.equal(response.status, 200);

      const payload = await response.json();
      assert.equal(payload.session.threadId, 'thr-resume');
      assert.equal(payload.session.latestTurn?.id, 'turn-restored');
      assert.equal(payload.session.latestTurn?.status, 'completed');
      assert.deepEqual(payload.conversation.messages, [
        createUserTimelineMessage({
          threadId: 'thr-resume',
          turnId: 'turn-restored',
          text: 'restored prompt',
          content: [{ type: 'text', text: 'restored prompt', text_elements: [] }],
        }),
        createAssistantTimelineMessage({
          threadId: 'thr-resume',
          turnId: 'turn-restored',
          text: 'restored answer',
          raw: {
            memoryCitation: null,
            phase: null,
          },
        }),
      ]);
    },
  );
});

test('real runtime startup exposes discovered prompt override options from custom-harness/prompts-override in session bootstrap', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'my-code-x-prompts-override-'));

  try {
    const customHarnessDir = createTempCustomHarnessDir(tempRoot);
    const promptsOverrideDir = path.join(customHarnessDir, 'prompts-override');
    const ambiguousPromptsDir = path.join(customHarnessDir, 'prompts');
    await fs.mkdir(promptsOverrideDir, { recursive: true });
    await fs.mkdir(ambiguousPromptsDir, { recursive: true });
    await fs.writeFile(path.join(promptsOverrideDir, 'normal.md'), 'Normal prompt override instructions\n', 'utf8');
    await fs.writeFile(path.join(promptsOverrideDir, 'cat.md'), 'You are a cute cat\n', 'utf8');
    await fs.writeFile(path.join(ambiguousPromptsDir, 'wrong.md'), 'ignore me\n', 'utf8');

    await withStartedServer(
      {
        codexWorkingDir: tempRoot,
        customHarnessDir,
      },
      async ({ port }) => {
        const response = await fetch(`http://127.0.0.1:${port}/api/v2/session?viewerId=viewer-prompts&slotId=tab-prompts`);

        assert.equal(response.status, 200);
        const payload = await response.json();
        assert.deepEqual(payload.options.promptOverrides, [
          { value: 'cat', label: 'cat', description: '' },
          { value: 'normal', label: 'normal', description: '' },
        ]);
      },
    );
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test('real runtime startup forwards prompt override instructions as baseInstructions during thread/start', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'my-code-x-prompts-override-start-'));
  const requestLogPath = path.join(tempRoot, 'codex-request-log.jsonl');

  try {
    const customHarnessDir = createTempCustomHarnessDir(tempRoot);
    const promptsOverrideDir = path.join(customHarnessDir, 'prompts-override');
    await fs.mkdir(promptsOverrideDir, { recursive: true });
    await fs.writeFile(path.join(promptsOverrideDir, 'normal.md'), 'Normal prompt override instructions\n', 'utf8');

    await withStartedServer(
      {
        codexWorkingDir: tempRoot,
        customHarnessDir,
        codexEnv: {
          FAKE_CODEX_REQUEST_LOG_FILE: requestLogPath,
        },
      },
      async ({ port }) => {
        const sendResponse = await fetch(`http://127.0.0.1:${port}/api/v2/chat/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({
            viewerId: 'viewer-prompts-start',
            slotId: 'tab-prompts-start',
            text: 'Use the normal override',
            runtimeSettings: {
              promptOverride: 'normal',
            },
          }),
        });

        assert.equal(sendResponse.status, 200);
        const loggedRequests = await waitForLoggedRequests(requestLogPath, 1);
        assert.deepEqual(loggedRequests[0], {
          method: 'thread/start',
          baseInstructions: 'Normal prompt override instructions\n',
          cwd: tempRoot,
          threadId: null,
        });
      },
    );
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test('real runtime startup forwards updated prompt override instructions as baseInstructions during thread/resume', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'my-code-x-prompts-override-resume-'));
  const requestLogPath = path.join(tempRoot, 'codex-request-log.jsonl');

  try {
    const customHarnessDir = createTempCustomHarnessDir(tempRoot);
    const promptsOverrideDir = path.join(customHarnessDir, 'prompts-override');
    await fs.mkdir(promptsOverrideDir, { recursive: true });
    await fs.writeFile(path.join(promptsOverrideDir, 'normal.md'), 'Normal prompt override instructions\n', 'utf8');
    await fs.writeFile(path.join(promptsOverrideDir, 'cat.md'), 'You are a cute cat\n', 'utf8');

    await withStartedServer(
      {
        codexWorkingDir: tempRoot,
        customHarnessDir,
        codexEnv: {
          FAKE_CODEX_REQUEST_LOG_FILE: requestLogPath,
        },
      },
      async ({ port }) => {
        const firstSendResponse = await fetch(`http://127.0.0.1:${port}/api/v2/chat/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({
            viewerId: 'viewer-prompts-resume',
            slotId: 'tab-prompts-resume',
            text: 'Start with normal',
            runtimeSettings: {
              promptOverride: 'normal',
            },
          }),
        });

        assert.equal(firstSendResponse.status, 200);

        const secondSendResponse = await fetch(`http://127.0.0.1:${port}/api/v2/chat/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({
            viewerId: 'viewer-prompts-resume',
            slotId: 'tab-prompts-resume',
            threadId: 'thr-stream',
            text: 'Switch to cat',
            runtimeSettings: {
              promptOverride: 'cat',
            },
          }),
        });

        assert.equal(secondSendResponse.status, 200);
        const loggedRequests = await waitForLoggedRequests(requestLogPath, 2);
        assert.deepEqual(loggedRequests.slice(0, 2), [
          {
            method: 'thread/start',
            baseInstructions: 'Normal prompt override instructions\n',
            cwd: tempRoot,
            threadId: null,
          },
          {
            method: 'thread/resume',
            baseInstructions: 'You are a cute cat\n',
            cwd: tempRoot,
            threadId: 'thr-stream',
          },
        ]);
      },
    );
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test('real runtime startup creates a missing Codex working directory before launching the child runtime', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'my-code-x-missing-cwd-'));
  const missingCodexWorkingDir = path.join(tempRoot, 'codex-working-dir');
  const requestLogPath = path.join(tempRoot, 'codex-request-log.jsonl');

  try {
    await withStartedServer(
      {
        codexWorkingDir: missingCodexWorkingDir,
        codexEnv: {
          FAKE_CODEX_REQUEST_LOG_FILE: requestLogPath,
        },
      },
      async ({ port }) => {
        const sendResponse = await fetch(`http://127.0.0.1:${port}/api/v2/chat/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({
            viewerId: 'viewer-missing-cwd',
            slotId: 'tab-missing-cwd',
            text: 'Start from a new working directory',
          }),
        });

        assert.equal(sendResponse.status, 200);
        const workingDirStats = await fs.stat(missingCodexWorkingDir);
        assert.equal(workingDirStats.isDirectory(), true);

        const loggedRequests = await waitForLoggedRequests(requestLogPath, 1);
        assert.equal(loggedRequests[0].cwd, missingCodexWorkingDir);
      },
    );
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test('real runtime startup preserves empty prompt override content as an explicit baseInstructions override', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'my-code-x-prompts-override-blank-'));
  const requestLogPath = path.join(tempRoot, 'codex-request-log.jsonl');

  try {
    const customHarnessDir = createTempCustomHarnessDir(tempRoot);
    const promptsOverrideDir = path.join(customHarnessDir, 'prompts-override');
    await fs.mkdir(promptsOverrideDir, { recursive: true });
    await fs.writeFile(path.join(promptsOverrideDir, 'blank.md'), '', 'utf8');

    await withStartedServer(
      {
        codexWorkingDir: tempRoot,
        customHarnessDir,
        codexEnv: {
          FAKE_CODEX_REQUEST_LOG_FILE: requestLogPath,
        },
      },
      async ({ port }) => {
        const sendResponse = await fetch(`http://127.0.0.1:${port}/api/v2/chat/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({
            viewerId: 'viewer-prompts-blank',
            slotId: 'tab-prompts-blank',
            text: 'Use the blank override',
            runtimeSettings: {
              promptOverride: 'blank',
            },
          }),
        });

        assert.equal(sendResponse.status, 200);
        const loggedRequests = await waitForLoggedRequests(requestLogPath, 1);
        assert.deepEqual(loggedRequests[0], {
          method: 'thread/start',
          baseInstructions: '',
          cwd: tempRoot,
          threadId: null,
        });
      },
    );
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test('real runtime startup uses the startup prompt override snapshot after files change on disk', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'my-code-x-prompts-override-snapshot-'));
  const requestLogPath = path.join(tempRoot, 'codex-request-log.jsonl');

  try {
    const customHarnessDir = createTempCustomHarnessDir(tempRoot);
    const promptsOverrideDir = path.join(customHarnessDir, 'prompts-override');
    await fs.mkdir(promptsOverrideDir, { recursive: true });
    await fs.writeFile(path.join(promptsOverrideDir, 'normal.md'), 'Normal prompt override instructions\n', 'utf8');
    await fs.writeFile(path.join(promptsOverrideDir, 'cat.md'), 'You are a cute cat\n', 'utf8');

    await withStartedServer(
      {
        codexWorkingDir: tempRoot,
        customHarnessDir,
        codexEnv: {
          FAKE_CODEX_REQUEST_LOG_FILE: requestLogPath,
        },
      },
      async ({ port }) => {
        await fs.writeFile(path.join(promptsOverrideDir, 'cat.md'), 'mutated after startup\n', 'utf8');

        const sendResponse = await fetch(`http://127.0.0.1:${port}/api/v2/chat/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({
            viewerId: 'viewer-prompts-snapshot',
            slotId: 'tab-prompts-snapshot',
            text: 'Use the startup snapshot',
            runtimeSettings: {
              promptOverride: 'cat',
            },
          }),
        });

        assert.equal(sendResponse.status, 200);
        const loggedRequests = await waitForLoggedRequests(requestLogPath, 1);
        assert.deepEqual(loggedRequests[0], {
          method: 'thread/start',
          baseInstructions: 'You are a cute cat\n',
          cwd: tempRoot,
          threadId: null,
        });
      },
    );
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test('real runtime startup degrades prompt override discovery failures to an empty options list', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'my-code-x-prompts-override-failure-'));

  try {
    const customHarnessDir = createTempCustomHarnessDir(tempRoot);
    await fs.mkdir(customHarnessDir, { recursive: true });
    await fs.writeFile(path.join(customHarnessDir, 'prompts-override'), 'not a directory\n', 'utf8');

    await withStartedServer(
      {
        codexWorkingDir: tempRoot,
        customHarnessDir,
      },
      async ({ port }) => {
        const response = await fetch(`http://127.0.0.1:${port}/api/v2/session?viewerId=viewer-prompts-fail&slotId=tab-prompts-fail`);

        assert.equal(response.status, 200);
        const payload = await response.json();
        assert.deepEqual(payload.options.promptOverrides, []);
      },
    );
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test('real runtime startup fails clearly when Codex initialize is rejected', async () => {
  await assert.rejects(
    startServer({
      host: '127.0.0.1',
      port: 0,
      authToken: '',
      codexCommand: process.execPath,
      codexArgs: [fakeCodexAppServerPath],
      codexEnv: { FAKE_CODEX_SCENARIO: 'initialize_error' },
    }),
    error => error instanceof Error && error.message === 'initialize exploded',
  );
});

test('real runtime startup identifies itself as Codex VS Code during initialize', async () => {
  await withStartedServer(
    {
      codexEnv: {
        FAKE_CODEX_EXPECTED_CLIENT_NAME: 'codex_vscode',
        FAKE_CODEX_EXPECTED_CLIENT_TITLE: 'Codex VS Code Extension',
      },
    },
    async () => {},
  );
});

test('real runtime startup forwards the selected workspace as cwd and exposes it in the session payload', async () => {
  const workspace = 'D:/workspaces/Workspace One';
  await withStartedServer(
    {
      codexEnv: {
        FAKE_CODEX_SCENARIO: 'workspace_cwd',
        FAKE_CODEX_EXPECTED_CWD: expectedPlainCodexWorkspaceCwd(workspace),
      },
    },
    async ({ port }) => {
      const sendResponse = await fetch(`http://127.0.0.1:${port}/api/v2/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          viewerId: 'viewer-workspace',
          slotId: 'tab-workspace',
          workspace,
          text: 'Explain this bug',
        }),
      });

      assert.equal(sendResponse.status, 200);

      const sessionResponse = await fetch(
        `http://127.0.0.1:${port}/api/v2/session?viewerId=viewer-workspace&slotId=tab-workspace&workspace=${encodeURIComponent(workspace)}&threadId=thr-stream`,
      );

      assert.equal(sessionResponse.status, 200);
      const payload = await sessionResponse.json();
      assert.equal(payload.session.workspace, workspace);
    },
  );
});

test('real runtime startup forwards the selected workspace as cwd for thread history', async () => {
  const workspace = 'D:/workspaces/Workspace One';
  await withStartedServer(
    {
      codexEnv: {
        FAKE_CODEX_SCENARIO: 'workspace_cwd',
        FAKE_CODEX_EXPECTED_CWD: expectedPlainCodexWorkspaceCwd(workspace),
      },
    },
    async ({ port }) => {
      const response = await fetch(
        `http://127.0.0.1:${port}/api/v2/thread/history?workspace=${encodeURIComponent(workspace)}&limit=5`,
      );

      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        data: [
          {
            id: 'thr-history',
            name: 'History thread',
            preview: 'History works',
            workspace: expectedPlainCodexWorkspaceCwd(workspace),
            createdAt: 1730910000,
            updatedAt: 1730910100,
            statusText: 'idle',
          },
        ],
      });
    },
  );
});

testWindowsOnly('real runtime thread history falls back to the extended Windows cwd only after a real empty plain-path query', async () => {
  const workspace = 'D:/workspaces/Workspace One';
  await withStartedServer(
    {
      codexEnv: {
        FAKE_CODEX_SCENARIO: 'workspace_cwd_history_query_fallback',
        FAKE_CODEX_EXPECTED_CWD: expectedPlainCodexWorkspaceCwd(workspace),
      },
    },
    async ({ port }) => {
      const response = await fetch(
        `http://127.0.0.1:${port}/api/v2/thread/history?workspace=${encodeURIComponent(workspace)}&limit=5`,
      );

      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        data: [
          {
            id: 'thr-history',
            name: 'History thread',
            preview: 'History works',
            workspace: expectedPlainCodexWorkspaceCwd(workspace),
            createdAt: 1730910000,
            updatedAt: 1730910100,
            statusText: 'idle',
          },
        ],
      });
    },
  );
});

test('real runtime startup forwards the selected workspace as a plain Windows cwd for thread/start', async () => {
  const workspace = 'D:/workspaces/Workspace One';
  await withStartedServer(
    {
      codexEnv: {
        FAKE_CODEX_SCENARIO: 'workspace_cwd',
        FAKE_CODEX_EXPECTED_CWD: expectedPlainCodexWorkspaceCwd(workspace),
      },
    },
    async ({ port }) => {
      const sendResponse = await fetch(`http://127.0.0.1:${port}/api/v2/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          viewerId: 'viewer-workspace-plain-start',
          slotId: 'tab-workspace-plain-start',
          workspace,
          text: 'Explain this bug',
        }),
      });

      assert.equal(sendResponse.status, 200);
    },
  );
});

test('real runtime startup forwards the selected workspace as a plain Windows cwd for thread/resume', async () => {
  const workspace = 'D:/workspaces/Workspace One';
  await withStartedServer(
    {
      codexEnv: {
        FAKE_CODEX_SCENARIO: 'workspace_cwd',
        FAKE_CODEX_EXPECTED_CWD: expectedPlainCodexWorkspaceCwd(workspace),
      },
    },
    async ({ port }) => {
      const response = await fetch(
        `http://127.0.0.1:${port}/api/v2/session?viewerId=viewer-plain-resume&slotId=tab-plain-resume&workspace=${encodeURIComponent(workspace)}&threadId=thr-resume`,
      );

      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.equal(payload.session.threadId, 'thr-resume');
      assert.equal(payload.session.workspace, workspace);
    },
  );
});

test('real runtime startup forwards the selected workspace as a plain Windows cwd for turn/start on an existing thread', async () => {
  const workspace = 'D:/workspaces/Workspace One';
  await withStartedServer(
    {
      codexEnv: {
        FAKE_CODEX_SCENARIO: 'workspace_cwd',
        FAKE_CODEX_EXPECTED_CWD: expectedPlainCodexWorkspaceCwd(workspace),
      },
    },
    async ({ port }) => {
      const response = await fetch(`http://127.0.0.1:${port}/api/v2/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          viewerId: 'viewer-plain-turn',
          slotId: 'tab-plain-turn',
          workspace,
          threadId: 'thr-resume',
          text: 'Continue this thread',
        }),
      });

      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        threadId: 'thr-resume',
        latestTurn: {
        id: 'turn-stream',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
        stream: {
          url: '/api/v2/chat/events?slotId=tab-plain-turn&threadId=thr-resume',
        },
      });
    },
  );
});

test('real runtime startup forwards the selected workspace as a plain Windows cwd for thread/fork', async () => {
  const workspace = 'D:/workspaces/Workspace One';
  await withStartedServer(
    {
      codexEnv: {
        FAKE_CODEX_SCENARIO: 'workspace_cwd',
        FAKE_CODEX_EXPECTED_CWD: expectedPlainCodexWorkspaceCwd(workspace),
      },
    },
    async ({ port }) => {
      const sessionResponse = await fetch(
        `http://127.0.0.1:${port}/api/v2/session?viewerId=viewer-plain-fork&slotId=tab-plain-fork&workspace=${encodeURIComponent(workspace)}&threadId=thr-resume`,
      );

      assert.equal(sessionResponse.status, 200);

      const response = await fetch(`http://127.0.0.1:${port}/api/v2/thread/fork`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          slotId: 'tab-plain-fork',
          threadId: 'thr-resume',
          workspace,
          preservedTurnCount: 1,
        }),
      });

      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        ok: true,
        threadId: 'thr-forked',
      });
    },
  );
});

test('real runtime startup forwards the selected workspace as a plain Windows cwd for thread/rollback', async () => {
  const workspace = 'D:/workspaces/Workspace One';
  await withStartedServer(
    {
      codexEnv: {
        FAKE_CODEX_SCENARIO: 'workspace_cwd',
        FAKE_CODEX_EXPECTED_CWD: expectedPlainCodexWorkspaceCwd(workspace),
      },
    },
    async ({ port }) => {
      const sessionResponse = await fetch(
        `http://127.0.0.1:${port}/api/v2/session?viewerId=viewer-plain-rollback&slotId=tab-plain-rollback&workspace=${encodeURIComponent(workspace)}&threadId=thr-resume`,
      );

      assert.equal(sessionResponse.status, 200);

      const response = await fetch(`http://127.0.0.1:${port}/api/v2/thread/rollback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          slotId: 'tab-plain-rollback',
          threadId: 'thr-resume',
          workspace,
          numTurns: 1,
        }),
      });

      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        ok: true,
        threadId: 'thr-resume',
      });
    },
  );
});

test('real runtime startup preserves raw stderr text when Codex exits during initialize', async () => {
  await assert.rejects(
    startServer({
      host: '127.0.0.1',
      port: 0,
      authToken: '',
      codexCommand: process.execPath,
      codexArgs: [fakeCodexAppServerPath],
      codexEnv: { FAKE_CODEX_SCENARIO: 'initialize_stderr_exit' },
    }),
    error => error instanceof Error && error.message === 'codex startup stderr exploded',
  );
});

test('server idle shutdown closes an unused Codex process and wakes a fresh one for the next send', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'my-code-x-idle-shutdown-'));
  const startLogPath = path.join(tempRoot, 'codex-start-log.jsonl');

  try {
    await withStartedServer(
      {
        codexEnv: {
          FAKE_CODEX_SCENARIO: 'streaming_happy',
          FAKE_CODEX_START_LOG_FILE: startLogPath,
        },
        idleShutdownConfig: {
          kind: 'enabled',
          idleTimeoutMinutes: 0.001,
          idleTimeoutMs: 60,
        },
      },
      async ({ port }) => {
        const firstSendResponse = await fetch(`http://127.0.0.1:${port}/api/v2/chat/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({
            viewerId: 'viewer-idle',
            slotId: 'tab-idle',
            text: 'first turn',
          }),
        });

        assert.equal(firstSendResponse.status, 200);
        await new Promise(resolve => setTimeout(resolve, 150));

        const secondSendResponse = await fetch(`http://127.0.0.1:${port}/api/v2/chat/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({
            viewerId: 'viewer-idle',
            slotId: 'tab-idle',
            threadId: 'thr-stream',
            text: 'second turn',
          }),
        });

        assert.equal(secondSendResponse.status, 200);

        const startEntries = await waitForLoggedRequests(startLogPath, 2);
        assert.equal(startEntries.length, 2);
        assert.notEqual(startEntries[0].pid, startEntries[1].pid);
      },
    );
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test('disabled idle shutdown keeps the current eager Codex startup behavior', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'my-code-x-idle-disabled-'));
  const startLogPath = path.join(tempRoot, 'codex-start-log.jsonl');

  try {
    await withStartedServer(
      {
        codexEnv: {
          FAKE_CODEX_SCENARIO: 'streaming_happy',
          FAKE_CODEX_START_LOG_FILE: startLogPath,
        },
        idleShutdownConfig: {
          kind: 'disabled',
        },
      },
      async ({ port }) => {
        const initialStartEntries = await waitForLoggedRequests(startLogPath, 1);
        assert.equal(initialStartEntries.length, 1);

        const sendResponse = await fetch(`http://127.0.0.1:${port}/api/v2/chat/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({
            viewerId: 'viewer-always-on',
            slotId: 'tab-always-on',
            text: 'first turn',
          }),
        });

        assert.equal(sendResponse.status, 200);

        const finalStartEntries = await waitForLoggedRequests(startLogPath, 1);
        assert.equal(finalStartEntries.length, 1);
      },
    );
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test('real runtime path returns broken stdio errors through the unified HTTP error payload', async () => {
  await withStartedServer(
    {
      codexEnv: { FAKE_CODEX_SCENARIO: 'stderr_on_turn_start' },
    },
    async ({ port }) => {
      const response = await fetch(`http://127.0.0.1:${port}/api/v2/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          viewerId: 'viewer-7',
          slotId: 'tab-7',
          text: 'Break the transport',
        }),
      });

      assert.equal(response.status, 502);
      assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
      assert.deepEqual(await response.json(), {
        error: {
          code: 'codex_turn_stderr_exploded',
          message: 'codex turn stderr exploded',
          status: 502,
        },
      });
    },
  );
});

test('restart requests keep the current backend alive until the restart script can take over', async () => {
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, restartHandoffProbeArgs, {
      cwd: path.join(__dirname, '..', '..'),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      stdout += chunk;
    });
    child.stderr.on('data', chunk => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('exit', code => {
      resolve({ code, stdout, stderr });
    });
  });

  assert.deepEqual(result, {
    code: 0,
    stdout: 'probe:pass\n',
    stderr: '',
  });
});

test('restart requests use single-flight spawning while a restart is already in progress', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'my-code-x-restart-'));
  const markerFilePath = path.join(tempDir, 'restart-spawns.log');
  process.env.WEB_CODEX_RESTART_MARKER_FILE = markerFilePath;

  try {
    await withStartedServer(
      {
        codexEnv: { FAKE_CODEX_SCENARIO: 'streaming_happy' },
        restartScript: fakeRestartSingleFlightScriptPath,
      },
      async ({ port }) => {
        const firstResponsePromise = fetch(`http://127.0.0.1:${port}/api/v2/app/restart`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({
            viewerId: 'viewer-a',
            slotId: 'tab-a',
            workspace: 'D:/workspaces/My-Code-X',
            threadId: 'thread-a',
          }),
        });
        const secondResponsePromise = fetch(`http://127.0.0.1:${port}/api/v2/app/restart`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({
            viewerId: 'viewer-b',
            slotId: 'tab-b',
            workspace: 'D:/workspaces/My-Code-X',
            threadId: 'thread-b',
          }),
        });

        const [firstResponse, secondResponse] = await Promise.all([firstResponsePromise, secondResponsePromise]);

        assert.equal(firstResponse.status, 200);
        assert.equal(secondResponse.status, 200);
        assert.deepEqual(await firstResponse.json(), {
          ok: true,
          restarting: true,
        });
        assert.deepEqual(await secondResponse.json(), {
          ok: true,
          restarting: true,
          alreadyRestarting: true,
        });

        const markerContent = await waitForFileContent({
          pathToRead: markerFilePath,
          isReady: content =>
            content
              .split(/\r?\n/)
              .map(line => line.trim())
              .filter(Boolean).length >= 1,
        });
        assert.equal(
          markerContent
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean).length,
          1,
        );
      },
    );
  } finally {
    delete process.env.WEB_CODEX_RESTART_MARKER_FILE;
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
