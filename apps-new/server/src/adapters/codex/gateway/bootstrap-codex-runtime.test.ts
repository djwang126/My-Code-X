import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { JsonValue } from '@my-code-x/contracts-new/json';
import { CodexBootstrapError } from '../errors/codex-runtime-error.js';
import type {
  CodexJsonlTransport,
  CodexServerRequestResponse,
  CodexTransportNotification,
  CodexTransportNotificationHandler,
  CodexTransportRequest,
} from '../transport/create-jsonl-transport.js';
import { bootstrapCodexRuntime } from './bootstrap-codex-runtime.js';

interface TestTransport {
  readonly transport: CodexJsonlTransport;
  readonly requests: readonly CodexTransportRequest[];
  readonly notifications: readonly CodexTransportNotification[];
}

function createBootstrapTransport(results: Record<string, JsonValue | Error>): TestTransport {
  const requests: CodexTransportRequest[] = [];
  const notifications: CodexTransportNotification[] = [];

  return {
    requests,
    notifications,
    transport: {
      async request(input: CodexTransportRequest): Promise<JsonValue> {
        requests.push(input);
        const result = results[input.method];

        if (result instanceof Error) {
          throw result;
        }

        return result ?? null;
      },

      async notify(input: CodexTransportNotification): Promise<void> {
        notifications.push(input);
      },

      async respondToServerRequest(_input: CodexServerRequestResponse): Promise<void> {},

      subscribe(_handler: CodexTransportNotificationHandler): () => void {
        return () => {};
      },

      async close(): Promise<void> {},
    },
  };
}

describe('bootstrapCodexRuntime', () => {
  test('initializes Codex and reads all bootstrap values', async () => {
    const testTransport = createBootstrapTransport({
      initialize: { ok: true },
      'model/list': { models: [{ id: 'gpt-5.4' }] },
      'config/read': { model: 'gpt-5.4' },
      'configRequirements/read': { approvals: ['never'] },
      'collaborationMode/list': { modes: [{ kind: 'default' }] },
    });

    const snapshot = await bootstrapCodexRuntime({ transport: testTransport.transport });

    assert.deepEqual(snapshot, {
      initialized: true,
      models: { models: [{ id: 'gpt-5.4' }] },
      config: { model: 'gpt-5.4' },
      configRequirements: { approvals: ['never'] },
      collaborationModes: { modes: [{ kind: 'default' }] },
    });
    assert.deepEqual(testTransport.requests, [
      {
        method: 'initialize',
        params: {
          clientInfo: {
            name: 'my_code_x_server_new',
            title: 'My Code X server-new',
            version: '0.0.0',
          },
          capabilities: {
            experimentalApi: true,
          },
        },
      },
      {
        method: 'model/list',
        params: {
          includeHidden: false,
        },
      },
      {
        method: 'config/read',
        params: {},
      },
      {
        method: 'configRequirements/read',
        params: {},
      },
      {
        method: 'collaborationMode/list',
        params: {},
      },
    ]);
    assert.deepEqual(testTransport.notifications, [
      {
        method: 'initialized',
        params: null,
      },
    ]);
  });

  test('wraps bootstrap read failures with a typed bootstrap error', async () => {
    const testTransport = createBootstrapTransport({
      initialize: { ok: true },
      'model/list': new Error('model endpoint down'),
      'config/read': {},
      'configRequirements/read': {},
      'collaborationMode/list': {},
    });

    await assert.rejects(
      () => bootstrapCodexRuntime({ transport: testTransport.transport }),
      (error: unknown) =>
        error instanceof CodexBootstrapError &&
        error.message === 'model/list failed during Codex bootstrap: model endpoint down',
    );
  });

  test('wraps initialize failures with a typed bootstrap error', async () => {
    const testTransport = createBootstrapTransport({
      initialize: new Error('initialize endpoint down'),
      'model/list': {},
      'config/read': {},
      'configRequirements/read': {},
      'collaborationMode/list': {},
    });

    await assert.rejects(
      () => bootstrapCodexRuntime({ transport: testTransport.transport }),
      (error: unknown) =>
        error instanceof CodexBootstrapError &&
        error.message === 'initialize failed during Codex bootstrap: initialize endpoint down',
    );
    assert.deepEqual(testTransport.notifications, []);
  });
});
