import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';

import type { EnvironmentVariables } from '../../../shared/index.js';
import {
  CodexProtocolError,
  CodexProcessExitError,
  CodexProcessStartError,
  CodexRequestTimeoutError,
  CodexRpcError,
  CodexTransportClosedError,
} from '../runtime/codex-runtime-error.js';
import {
  createJsonlTransport,
  type CodexJsonlTransport,
  type CodexTransportTimer,
  type CodexTransportTimerHandle,
} from './create-jsonl-transport.js';
import type { CodexIncomingMessage } from './jsonl-message.js';

interface FixtureRuntime {
  readonly cwd: string;
  readonly scriptPath: string;
  close(): Promise<void>;
}

interface CreateTransportOptions {
  readonly requestTimeoutMs?: number;
  readonly requestTimer?: CodexTransportTimer;
}

interface ManualTimeout {
  readonly callback: () => void;
  readonly milliseconds: number;
  active: boolean;
}

interface ManualRequestTimer {
  readonly timer: CodexTransportTimer;
  fireNext(): void;
  activeTimeoutMilliseconds(): readonly number[];
}

async function createFixtureRuntime(source: string): Promise<FixtureRuntime> {
  const cwd = await mkdtemp(path.join(tmpdir(), 'server-new-codex-transport-'));
  const scriptPath = path.join(cwd, 'fake-codex-app-server.mjs');
  await writeFile(scriptPath, source, 'utf-8');

  return {
    cwd,
    scriptPath,
    async close(): Promise<void> {
      await rm(cwd, { recursive: true, force: true });
    },
  };
}

function createManualRequestTimer(): ManualRequestTimer {
  const scheduled: ManualTimeout[] = [];

  return {
    timer: {
      setTimeout(callback: () => void, milliseconds: number): CodexTransportTimerHandle {
        const timeout: ManualTimeout = {
          active: true,
          callback,
          milliseconds,
        };
        scheduled.push(timeout);
        return timeout;
      },

      clearTimeout(handle: CodexTransportTimerHandle): void {
        if (isManualTimeout(handle)) {
          handle.active = false;
        }
      },
    },

    fireNext(): void {
      const nextTimeout = scheduled.find(timeout => timeout.active) ?? null;
      if (!nextTimeout) {
        throw new Error('expected an active timeout');
      }

      nextTimeout.active = false;
      nextTimeout.callback();
    },

    activeTimeoutMilliseconds(): readonly number[] {
      return scheduled.filter(timeout => timeout.active).map(timeout => timeout.milliseconds);
    },
  };
}

function isManualTimeout(handle: CodexTransportTimerHandle): handle is ManualTimeout {
  return typeof handle === 'object' && handle !== null && 'callback' in handle && 'active' in handle;
}

function createTestProcessEnv(): EnvironmentVariables {
  return {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
  };
}

function createTransport(fixture: FixtureRuntime, options: CreateTransportOptions = {}): CodexJsonlTransport {
  return createJsonlTransport({
    command: process.execPath,
    args: [fixture.scriptPath],
    cwd: fixture.cwd,
    env: createTestProcessEnv(),
    requestTimeoutMs: options.requestTimeoutMs ?? 5_000,
    requestTimer: options.requestTimer,
  });
}

function createReadlineServerScript(body: string): string {
  return `
import readline from 'node:readline';

const lines = readline.createInterface({ input: process.stdin });

function write(message) {
  process.stdout.write(JSON.stringify(message) + '\\n');
}

lines.on('line', line => {
  const message = JSON.parse(line);
${body}
});
`;
}

function echoServerScript(): string {
  return createReadlineServerScript(`
  write({
    id: message.id,
    result: {
      echoedMethod: message.method,
      echoedParams: message.params,
    },
  });
`);
}

function outOfOrderResponseServerScript(): string {
  return `
import readline from 'node:readline';

const lines = readline.createInterface({ input: process.stdin });
const pending = [];

function write(message) {
  process.stdout.write(JSON.stringify(message) + '\\n');
}

lines.on('line', line => {
  const message = JSON.parse(line);
  pending.push(message);

  if (pending.length !== 2) {
    return;
  }

  const first = pending[0];
  const second = pending[1];
  write({ id: second.id, result: { value: 'second' } });
  write({ id: first.id, result: { value: 'first' } });
});
`;
}

function unknownResponseIdServerScript(): string {
  return createReadlineServerScript(`
  write({ id: '999', result: { value: 'unknown' } });
  write({ id: message.id, result: { value: 'matched' } });
`);
}

function rpcErrorServerScript(): string {
  return createReadlineServerScript(`
  write({
    id: message.id,
    error: {
      code: 400,
      message: 'bad request',
    },
  });
`);
}

function invalidJsonServerScript(): string {
  return createReadlineServerScript(`
  process.stdout.write('{not-json\\n');
`);
}

function delayedResponseServerScript(): string {
  return `
import readline from 'node:readline';

const lines = readline.createInterface({ input: process.stdin });
let delayedResponse = null;

function write(message) {
  process.stdout.write(JSON.stringify(message) + '\\n');
}

lines.on('line', line => {
  const message = JSON.parse(line);

  if (message.method === 'release-delayed') {
    if (delayedResponse) {
      write(delayedResponse);
    }
    return;
  }

  if (message.method === 'echo-after-timeout') {
    write({ id: message.id, result: { value: 'after-timeout' } });
    return;
  }

  delayedResponse = { id: message.id, result: { value: 'late-response' } };
  write({
    method: 'request/received',
    params: {
      method: message.method,
    },
  });
});
`;
}

function processExitAfterRequestServerScript(): string {
  return createReadlineServerScript(`
  process.stderr.write('fatal codex failure', () => {
    process.exit(7);
  });
`);
}

function eventsServerScript(): string {
  return createReadlineServerScript(`
  if (message.method === 'emit-events') {
    write({
      method: 'system/notice',
      params: {
        threadId: 'thread-1',
        level: 'warning',
        message: 'notice from fixture',
      },
    });
    write({
      id: 'server-1',
      method: 'approval/request',
      params: {
        threadId: 'thread-1',
        prompt: 'Approve?',
      },
    });
    return;
  }

  if (message.id === 'server-1') {
    write({
      method: 'server/response-seen',
      params: {
        approved: message.result.approved,
      },
    });
  }
`);
}

function eventOnRequestServerScript(): string {
  return createReadlineServerScript(`
  write({
    method: 'system/notice',
    params: {
      message: message.params.message,
    },
  });
  write({
    id: message.id,
    result: {
      ok: true,
    },
  });
`);
}

function silentServerScript(): string {
  return createReadlineServerScript(`
  write({
    method: 'request/received',
    params: {
      method: message.method,
    },
  });
`);
}

describe('createJsonlTransport', () => {
  test('fails explicitly when the Codex process cannot be started', async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), 'server-new-codex-missing-cwd-'));
    const missingCwd = path.join(cwd, 'missing');

    try {
      assert.throws(
        () =>
          createJsonlTransport({
            command: process.execPath,
            args: [],
            cwd: missingCwd,
            env: createTestProcessEnv(),
            requestTimeoutMs: 5_000,
          }),
        (error: unknown) => error instanceof CodexProcessStartError,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test('writes JSONL requests and resolves matching responses', async () => {
    const fixture = await createFixtureRuntime(echoServerScript());
    const transport = createTransport(fixture);

    try {
      const result = await transport.request({
        method: 'thread/list',
        params: {
          cwd: '/workspace',
          limit: 2,
          archived: false,
        },
      });

      assert.deepEqual(result, {
        echoedMethod: 'thread/list',
        echoedParams: {
          cwd: '/workspace',
          limit: 2,
          archived: false,
        },
      });
    } finally {
      await transport.close();
      await fixture.close();
    }
  });

  test('resolves out-of-order responses by id', async () => {
    const fixture = await createFixtureRuntime(outOfOrderResponseServerScript());
    const transport = createTransport(fixture);

    try {
      const first = transport.request({ method: 'first', params: {} });
      const second = transport.request({ method: 'second', params: {} });

      assert.deepEqual(await Promise.all([first, second]), [
        {
          value: 'first',
        },
        {
          value: 'second',
        },
      ]);
    } finally {
      await transport.close();
      await fixture.close();
    }
  });

  test('ignores responses with unknown ids while keeping the matching request pending', async () => {
    const fixture = await createFixtureRuntime(unknownResponseIdServerScript());
    const transport = createTransport(fixture);

    try {
      assert.deepEqual(await transport.request({ method: 'thread/list', params: {} }), {
        value: 'matched',
      });
    } finally {
      await transport.close();
      await fixture.close();
    }
  });

  test('rejects Codex RPC errors with method and code metadata', async () => {
    const fixture = await createFixtureRuntime(rpcErrorServerScript());
    const transport = createTransport(fixture);

    try {
      await assert.rejects(
        () => transport.request({ method: 'turn/start', params: {} }),
        (error: unknown) =>
          error instanceof CodexRpcError &&
          error.method === 'turn/start' &&
          error.code === 400 &&
          error.message === 'bad request',
      );
    } finally {
      await transport.close();
      await fixture.close();
    }
  });

  test('rejects pending requests when Codex sends invalid JSONL', async () => {
    const fixture = await createFixtureRuntime(invalidJsonServerScript());
    const transport = createTransport(fixture);

    try {
      await assert.rejects(
        () => transport.request({ method: 'turn/start', params: {} }),
        (error: unknown) =>
          error instanceof CodexProtocolError &&
          error.message.startsWith('Codex JSONL message is not valid JSON:'),
      );

      await assert.rejects(
        () => transport.request({ method: 'turn/start', params: {} }),
        (error: unknown) =>
          error instanceof CodexProtocolError &&
          error.message.startsWith('Codex JSONL message is not valid JSON:'),
      );
    } finally {
      await transport.close();
      await fixture.close();
    }
  });

  test('times out pending requests deterministically and ignores their late responses', async () => {
    const fixture = await createFixtureRuntime(delayedResponseServerScript());
    const manualTimer = createManualRequestTimer();
    const transport = createTransport(fixture, {
      requestTimeoutMs: 30_000,
      requestTimer: manualTimer.timer,
    });
    let resolveRequestReceived: () => void = () => {};
    const requestReceived = new Promise<void>(resolve => {
      resolveRequestReceived = resolve;
    });
    transport.subscribe(message => {
      if (message.kind === 'notification' && message.method === 'request/received') {
        resolveRequestReceived();
      }
    });

    try {
      const pending = transport.request({ method: 'turn/start', params: {} });
      const pendingRejected = assert.rejects(
        pending,
        (error: unknown) =>
          error instanceof CodexRequestTimeoutError &&
          error.method === 'turn/start' &&
          error.waitedMs === 30_000 &&
          error.message === 'Codex request timed out: turn/start after 30000ms',
      );

      await requestReceived;
      assert.deepEqual(manualTimer.activeTimeoutMilliseconds(), [30_000]);
      manualTimer.fireNext();
      await pendingRejected;
      assert.deepEqual(manualTimer.activeTimeoutMilliseconds(), []);

      await transport.notify({ method: 'release-delayed', params: null });
      assert.deepEqual(await transport.request({ method: 'echo-after-timeout', params: {} }), {
        value: 'after-timeout',
      });
    } finally {
      await transport.close();
      await fixture.close();
    }
  });

  test('rejects pending requests when the Codex process exits with stderr', async () => {
    const fixture = await createFixtureRuntime(processExitAfterRequestServerScript());
    const transport = createTransport(fixture);

    try {
      await assert.rejects(
        () => transport.request({ method: 'turn/start', params: {} }),
        (error: unknown) =>
          error instanceof CodexProcessExitError &&
          error.reason === 'code 7' &&
          error.stderr === 'fatal codex failure' &&
          error.message === 'Codex process exited with code 7: fatal codex failure',
      );
    } finally {
      await transport.close();
      await fixture.close();
    }
  });

  test('publishes notifications and server requests, then writes server request responses', async () => {
    const fixture = await createFixtureRuntime(eventsServerScript());
    const transport = createTransport(fixture);
    const messages: CodexIncomingMessage[] = [];
    let resolveServerRequest: (value: CodexIncomingMessage) => void = () => {};
    let resolveResponseSeen: (value: CodexIncomingMessage) => void = () => {};
    const serverRequestSeen = new Promise<CodexIncomingMessage>(resolve => {
      resolveServerRequest = resolve;
    });
    const responseSeen = new Promise<CodexIncomingMessage>(resolve => {
      resolveResponseSeen = resolve;
    });

    const unsubscribe = transport.subscribe(message => {
      messages.push(message);
      if (message.kind === 'server-request') {
        resolveServerRequest(message);
      }
      if (message.kind === 'notification' && message.method === 'server/response-seen') {
        resolveResponseSeen(message);
      }
    });

    try {
      await transport.notify({ method: 'emit-events', params: null });
      const serverRequest = await serverRequestSeen;

      assert.deepEqual(messages, [
        {
          kind: 'notification',
          method: 'system/notice',
          params: {
            threadId: 'thread-1',
            level: 'warning',
            message: 'notice from fixture',
          },
        },
        {
          kind: 'server-request',
          id: 'server-1',
          method: 'approval/request',
          params: {
            threadId: 'thread-1',
            prompt: 'Approve?',
          },
        },
      ]);
      assert.deepEqual(serverRequest, {
        kind: 'server-request',
        id: 'server-1',
        method: 'approval/request',
        params: {
          threadId: 'thread-1',
          prompt: 'Approve?',
        },
      });

      await transport.respondToServerRequest({
        requestId: 'server-1',
        result: {
          approved: true,
        },
      });

      assert.deepEqual(await responseSeen, {
        kind: 'notification',
        method: 'server/response-seen',
        params: {
          approved: true,
        },
      });
      assert.deepEqual(messages, [
        {
          kind: 'notification',
          method: 'system/notice',
          params: {
            threadId: 'thread-1',
            level: 'warning',
            message: 'notice from fixture',
          },
        },
        {
          kind: 'server-request',
          id: 'server-1',
          method: 'approval/request',
          params: {
            threadId: 'thread-1',
            prompt: 'Approve?',
          },
        },
        {
          kind: 'notification',
          method: 'server/response-seen',
          params: {
            approved: true,
          },
        },
      ]);
      unsubscribe();
    } finally {
      await transport.close();
      await fixture.close();
    }
  });

  test('stops publishing messages to a subscriber after unsubscribe', async () => {
    const fixture = await createFixtureRuntime(eventOnRequestServerScript());
    const transport = createTransport(fixture);
    const messages: CodexIncomingMessage[] = [];
    const unsubscribe = transport.subscribe(message => {
      messages.push(message);
    });

    try {
      assert.deepEqual(await transport.request({ method: 'emit-notification', params: { message: 'first' } }), {
        ok: true,
      });
      unsubscribe();
      assert.deepEqual(await transport.request({ method: 'emit-notification', params: { message: 'second' } }), {
        ok: true,
      });

      assert.deepEqual(messages, [
        {
          kind: 'notification',
          method: 'system/notice',
          params: {
            message: 'first',
          },
        },
      ]);
    } finally {
      await transport.close();
      await fixture.close();
    }
  });

  test('close rejects pending requests and makes later requests fail explicitly', async () => {
    const fixture = await createFixtureRuntime(silentServerScript());
    const transport = createTransport(fixture);
    let resolveRequestReceived: () => void = () => {};
    const requestReceived = new Promise<void>(resolve => {
      resolveRequestReceived = resolve;
    });
    transport.subscribe(message => {
      if (message.kind === 'notification' && message.method === 'request/received') {
        resolveRequestReceived();
      }
    });
    const pending = transport.request({ method: 'turn/start', params: {} });
    const pendingRejected = assert.rejects(
      pending,
      (error: unknown) => error instanceof CodexTransportClosedError && error.message === 'Codex transport is closed',
    );

    try {
      await requestReceived;
      await transport.close();
      await transport.close();
      await pendingRejected;
      await assert.rejects(
        () => transport.request({ method: 'turn/start', params: {} }),
        (error: unknown) => error instanceof CodexTransportClosedError && error.message === 'Codex transport is closed',
      );
    } finally {
      await fixture.close();
    }
  });
});
