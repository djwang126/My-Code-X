import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';

import type { EnvironmentVariables } from '../../shared/index.js';
import { CodexBootstrapError, CodexRpcError, CodexTransportClosedError, createCodexRuntime } from './index.js';

interface RuntimeFixture {
  readonly cwd: string;
  readonly scriptPath: string;
  close(): Promise<void>;
}

async function createRuntimeFixture(): Promise<RuntimeFixture> {
  const cwd = await mkdtemp(path.join(tmpdir(), 'server-new-codex-runtime-'));
  const scriptPath = path.join(cwd, 'fake-codex-runtime.mjs');
  await writeFile(scriptPath, createRuntimeFixtureScript(), 'utf-8');

  return {
    cwd,
    scriptPath,
    async close(): Promise<void> {
      await rm(cwd, { recursive: true, force: true });
    },
  };
}

function createRuntimeFixtureScript(): string {
  return `
import readline from 'node:readline';

const lines = readline.createInterface({ input: process.stdin });
const scenario = process.argv[2] || '';

function write(message) {
  process.stdout.write(JSON.stringify(message) + '\\n');
}

lines.on('line', line => {
  const message = JSON.parse(line);

  switch (message.method) {
    case 'initialize':
      write({ id: message.id, result: { ok: true } });
      return;
    case 'initialized':
      return;
    case 'model/list':
      write({ id: message.id, result: { models: [{ id: 'gpt-5.4' }] } });
      return;
    case 'config/read':
      write({ id: message.id, result: { model: 'gpt-5.4' } });
      return;
    case 'configRequirements/read':
      write({ id: message.id, result: { approvals: ['never'] } });
      return;
    case 'collaborationMode/list':
      write({ id: message.id, result: { modes: [{ kind: 'default' }] } });
      return;
    case 'thread/start':
      write({ id: message.id, result: { thread: { id: 'thread-1' } } });
      return;
    case 'turn/start':
      if (scenario === 'turn-error') {
        write({
          id: message.id,
          error: {
            code: 500,
            message: 'turn start failed',
          },
        });
        return;
      }
      write({ id: message.id, result: { turn: { id: 'turn-1' } } });
      if (scenario === 'malformed-event') {
        write({
          method: 'turn/started',
          params: {
            turnId: 'turn-1',
          },
        });
        return;
      }
      write({
        method: 'turn/started',
        params: {
          threadId: message.params.threadId,
          turnId: 'turn-1',
        },
      });
      return;
    default:
      write({
        id: message.id,
        error: {
          code: 404,
          message: 'unknown method ' + message.method,
        },
      });
  }
});
`;
}

function createTestProcessEnv(): EnvironmentVariables {
  return {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
  };
}

function createFailingBootstrapFixtureScript(): string {
  return `
import fs from 'node:fs';
import readline from 'node:readline';

const markerPath = process.argv[2];
const lines = readline.createInterface({ input: process.stdin });

function write(message) {
  process.stdout.write(JSON.stringify(message) + '\\n');
}

lines.on('line', line => {
  const message = JSON.parse(line);

  switch (message.method) {
    case 'initialize':
      write({ id: message.id, result: { ok: true } });
      return;
    case 'initialized':
      return;
    case 'model/list':
      write({
        id: message.id,
        error: {
          code: 500,
          message: 'model list failed',
        },
      });
      return;
    default:
      write({ id: message.id, result: {} });
  }
});

lines.on('close', () => {
  fs.writeFileSync(markerPath, 'closed', 'utf-8');
  process.exit(0);
});
`;
}

describe('createCodexRuntime', () => {
  test('returns a ready runtime that can send commands and publish runtime events after bootstrap', async () => {
    const fixture = await createRuntimeFixture();
    const runtime = await createCodexRuntime({
      options: {
        command: process.execPath,
        args: [fixture.scriptPath],
        cwd: fixture.cwd,
        env: createTestProcessEnv(),
        requestTimeoutMs: 5_000,
        dynamicTools: [],
      },
      logger: {
        warn(_message: string): void {},
      },
    });
    const events: unknown[] = [];
    let resolveRuntimeEvent: () => void = () => {};
    const runtimeEventSeen = new Promise<void>(resolve => {
      resolveRuntimeEvent = resolve;
    });
    runtime.subscribe(event => {
      events.push(event);
      resolveRuntimeEvent();
    });

    try {
      const threadResult = await runtime.send({
        kind: 'start-thread',
        workspace: '/workspace',
        runtimeSettings: null,
        baseInstructions: null,
      });
      const turnResult = await runtime.send({
        kind: 'start-turn',
        threadId: 'thread-1',
        message: 'Hello',
        content: [],
        runtimeSettings: null,
      });
      await runtimeEventSeen;

      assert.deepEqual(threadResult, {
        kind: 'thread-started',
        threadId: 'thread-1',
      });
      assert.deepEqual(turnResult, {
        kind: 'turn-started',
        turnId: 'turn-1',
      });
      assert.deepEqual(events, [
        {
          kind: 'runtime-turn-started',
          threadId: 'thread-1',
          turnId: 'turn-1',
        },
      ]);
    } finally {
      await runtime.close();
      await fixture.close();
    }
  });

  test('closes the Codex process when bootstrap fails', async () => {
    const fixture = await createRuntimeFixture();
    const markerPath = path.join(fixture.cwd, 'transport-closed.txt');
    await writeFile(fixture.scriptPath, createFailingBootstrapFixtureScript(), 'utf-8');

    try {
      await assert.rejects(
        () =>
          createCodexRuntime({
            options: {
              command: process.execPath,
              args: [fixture.scriptPath, markerPath],
              cwd: fixture.cwd,
              env: createTestProcessEnv(),
              requestTimeoutMs: 5_000,
              dynamicTools: [],
            },
            logger: {
              warn(_message: string): void {},
            },
          }),
        (error: unknown) =>
          error instanceof CodexBootstrapError &&
          error.message === 'model/list failed during Codex bootstrap: model list failed',
      );
      assert.equal(await readFile(markerPath, 'utf-8'), 'closed');
    } finally {
      await fixture.close();
    }
  });

  test('rejects sends after a successfully created runtime closes', async () => {
    const fixture = await createRuntimeFixture();
    const runtime = await createCodexRuntime({
      options: {
        command: process.execPath,
        args: [fixture.scriptPath],
        cwd: fixture.cwd,
        env: createTestProcessEnv(),
        requestTimeoutMs: 5_000,
        dynamicTools: [],
      },
      logger: {
        warn(_message: string): void {},
      },
    });

    try {
      await runtime.close();
      await runtime.close();
      await assert.rejects(
        () =>
          runtime.send({
            kind: 'start-turn',
            threadId: 'thread-1',
            message: 'Hello after close',
            content: [],
            runtimeSettings: null,
          }),
        (error: unknown) => error instanceof CodexTransportClosedError && error.message === 'Codex transport is closed',
      );
    } finally {
      await fixture.close();
    }
  });

  test('preserves typed RPC errors through the complete runtime adapter', async () => {
    const fixture = await createRuntimeFixture();
    const runtime = await createCodexRuntime({
      options: {
        command: process.execPath,
        args: [fixture.scriptPath, 'turn-error'],
        cwd: fixture.cwd,
        env: createTestProcessEnv(),
        requestTimeoutMs: 5_000,
        dynamicTools: [],
      },
      logger: {
        warn(_message: string): void {},
      },
    });

    try {
      await assert.rejects(
        () =>
          runtime.send({
            kind: 'start-turn',
            threadId: 'thread-1',
            message: 'Hello',
            content: [],
            runtimeSettings: null,
          }),
        (error: unknown) =>
          error instanceof CodexRpcError &&
          error.method === 'turn/start' &&
          error.code === 500 &&
          error.message === 'turn start failed',
      );
    } finally {
      await runtime.close();
      await fixture.close();
    }
  });

  test('turns malformed notifications into runtime-error events through the complete runtime adapter', async () => {
    const fixture = await createRuntimeFixture();
    const runtime = await createCodexRuntime({
      options: {
        command: process.execPath,
        args: [fixture.scriptPath, 'malformed-event'],
        cwd: fixture.cwd,
        env: createTestProcessEnv(),
        requestTimeoutMs: 5_000,
        dynamicTools: [],
      },
      logger: {
        warn(_message: string): void {},
      },
    });
    const events: unknown[] = [];
    let resolveRuntimeEvent: () => void = () => {};
    const runtimeEventSeen = new Promise<void>(resolve => {
      resolveRuntimeEvent = resolve;
    });
    runtime.subscribe(event => {
      events.push(event);
      resolveRuntimeEvent();
    });

    try {
      assert.deepEqual(
        await runtime.send({
          kind: 'start-turn',
          threadId: 'thread-1',
          message: 'Hello',
          content: [],
          runtimeSettings: null,
        }),
        {
          kind: 'turn-started',
          turnId: 'turn-1',
        },
      );
      await runtimeEventSeen;

      assert.deepEqual(events, [
        {
          kind: 'runtime-error',
          threadId: null,
          turnId: null,
          error: {
            message: 'Codex turn/started threadId must be a string',
            code: 'CodexProtocolError',
          },
        },
      ]);
    } finally {
      await runtime.close();
      await fixture.close();
    }
  });
});
