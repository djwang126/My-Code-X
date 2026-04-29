import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createWorkspaceService } from './workspace-service.js';
import type { RuntimeCommand, RuntimeEventHandler, RuntimePort, RuntimeResult } from '../../ports/index.js';

function createRuntime(results: readonly RuntimeResult[]): { readonly calls: RuntimeCommand[]; readonly runtime: RuntimePort } {
  const calls: RuntimeCommand[] = [];
  const pendingResults = [...results];

  return {
    calls,
    runtime: {
      async send(command: RuntimeCommand): Promise<RuntimeResult> {
        calls.push(command);
        const result = pendingResults.shift();
        if (!result) {
          return { kind: 'ok' };
        }

        return result;
      },

      subscribe(_handler: RuntimeEventHandler) {
        return () => {};
      },

      async close() {},
    },
  };
}

describe('createWorkspaceService', () => {
  test('lists workspace threads through the workspace feature', async () => {
    const runtime = createRuntime([
      {
        kind: 'threads-listed',
        threads: [
          {
            threadId: 'thread-1',
            title: 'Thread one',
            workspace: 'workspace-1',
            updatedAt: '2026-04-29T00:00:00.000Z',
          },
        ],
      },
    ]);
    const service = createWorkspaceService({ runtime: runtime.runtime });

    const threads = await service.listThreads({
      kind: 'list-workspace-threads',
      workspace: 'workspace-1',
      limit: 20,
      archived: false,
    });

    assert.deepEqual(runtime.calls, [
      {
        kind: 'list-threads',
        workspace: 'workspace-1',
        limit: 20,
        archived: false,
      },
    ]);
    assert.deepEqual(threads, [
      {
        threadId: 'thread-1',
        title: 'Thread one',
        workspace: 'workspace-1',
        updatedAt: '2026-04-29T00:00:00.000Z',
      },
    ]);
  });
});
