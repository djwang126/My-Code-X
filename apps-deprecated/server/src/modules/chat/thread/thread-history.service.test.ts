import test from 'node:test';
import assert from 'node:assert/strict';

import { createChatService } from '../index.js';

test('listThreadHistory requests each archived state once and sorts the merged gateway results', async () => {
  const calls = [];
  const workspace = 'D:/workspace/example-app-worktree';
  const service = createChatService({
    codexGateway: {
      async listThreads({ workspace: requestedWorkspace, limit, archived }) {
        calls.push({ workspace: requestedWorkspace, limit, archived });

        if (archived) {
          return [
            {
              id: 'thread-archived',
              name: 'Archived thread',
              preview: 'older',
              workspace: requestedWorkspace,
              createdAt: 1_700_000_000,
              updatedAt: 1_700_000_150,
              statusText: 'completed',
            },
            {
              id: 'thread-shared',
              name: 'Shared thread',
              preview: 'archived duplicate',
              workspace: requestedWorkspace,
              createdAt: 1_700_000_000,
              updatedAt: 1_700_000_090,
              statusText: 'completed',
            },
          ];
        }

        return [
          {
            id: 'thread-active',
            name: 'Active thread',
            preview: 'latest',
            workspace: requestedWorkspace,
            createdAt: 1_700_000_000,
            updatedAt: 1_700_000_200,
            statusText: 'idle',
          },
          {
            id: 'thread-shared',
            name: 'Shared thread',
            preview: 'active duplicate',
            workspace: requestedWorkspace,
            createdAt: 1_700_000_000,
            updatedAt: 1_700_000_100,
            statusText: 'idle',
          },
        ];
      },
    },
  });

  const history = await service.listThreadHistory({ workspace, limit: 5 });

  assert.deepEqual(history, [
    {
      id: 'thread-active',
      name: 'Active thread',
      preview: 'latest',
      workspace,
      createdAt: 1_700_000_000,
      updatedAt: 1_700_000_200,
      statusText: 'idle',
    },
    {
      id: 'thread-archived',
      name: 'Archived thread',
      preview: 'older',
      workspace,
      createdAt: 1_700_000_000,
      updatedAt: 1_700_000_150,
      statusText: 'completed',
    },
    {
      id: 'thread-shared',
      name: 'Shared thread',
      preview: 'active duplicate',
      workspace,
      createdAt: 1_700_000_000,
      updatedAt: 1_700_000_100,
      statusText: 'idle',
    },
  ]);

  assert.deepEqual(calls, [
    { workspace, limit: 5, archived: false },
    { workspace, limit: 5, archived: true },
  ]);
});

test('listThreadHistory returns an empty list without querying Codex when no workspace is selected', async () => {
  let callCount = 0;
  const service = createChatService({
    codexGateway: {
      async listThreads() {
        callCount += 1;
        return [];
      },
    },
  });

  const history = await service.listThreadHistory({ workspace: '', limit: 5 });

  assert.deepEqual(history, []);
  assert.equal(callCount, 0);
});
