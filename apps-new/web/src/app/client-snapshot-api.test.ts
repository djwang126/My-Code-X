import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

import { createClientSnapshotApiBoundary } from './client-snapshot-api.js';

const originalWindow = globalThis.window;

afterEach(() => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: originalWindow,
  });
});

describe('client snapshot api boundary', () => {
  test('loads and validates the conversation snapshot from client bootstrap response', async () => {
    let requestBody: unknown = null;
    installFetch(async (_resource, init) => {
      requestBody = JSON.parse(String(init?.body));

      return new globalThis.Response(JSON.stringify({
        conversation: {
          status: 'ready',
          revision: 0,
          items: [],
        },
        ignored: true,
      }), {
        status: 200,
      });
    });

    const api = createClientSnapshotApiBoundary();
    const snapshot = await api.loadSnapshot({
      scope: {
        slotId: 'slot-1',
        workspaceId: null,
        threadId: null,
        label: 'slot slot-1',
      },
    });

    assert.deepEqual(requestBody, {
      kind: 'open-client',
      scope: {
        slotId: 'slot-1',
        workspaceId: null,
        threadId: null,
      },
      payload: {},
    });
    assert.deepEqual(snapshot, {
      conversation: {
        status: 'ready',
        revision: 0,
        items: [],
      },
    });
  });

  test('rejects invalid bootstrap response shape at the boundary', async () => {
    installFetch(async () => new globalThis.Response(JSON.stringify({
      conversation: {
        status: 'ready',
        revision: 0,
        items: [],
        timestamp: 'not allowed',
      },
    }), {
      status: 200,
    }));

    const api = createClientSnapshotApiBoundary();

    await assert.rejects(api.loadSnapshot({
      scope: {
        slotId: 'slot-1',
        workspaceId: null,
        threadId: null,
        label: 'slot slot-1',
      },
    }));
  });
});

type FetchReplacement = typeof window.fetch;

function installFetch(fetch: FetchReplacement): void {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      fetch,
    },
  });
}

