import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { openClient } from './open-client.js';
import type { ConversationService } from '../features/conversation/index.js';
import { createSlotService } from '../features/slot/index.js';
import type { ThreadActionsService } from '../features/thread-actions/index.js';
import { createThreadService } from '../features/thread/index.js';
import type { TurnService } from '../features/turn/index.js';
import type { WorkspaceService } from '../features/workspace/index.js';
import type { DomainEvent, EventBusPort, RuntimePort } from '../ports/index.js';

const events: EventBusPort = {
  publish(_event: DomainEvent) {},
  subscribe() {
    return () => {};
  },
};

function createOpenClientDependencies() {
  const conversation: ConversationService = {
    apply() {
      return { revision: 0, items: [] };
    },
    snapshot() {
      return { revision: 0, items: [] };
    },
  };
  const turn: TurnService = {
    apply() {
      return {
        current: null,
      };
    },
    snapshot() {
      return {
        current: null,
      };
    },
  };
  const workspace: WorkspaceService = {
    async inspect(input) {
      return {
        available: Boolean(input.workspace),
        workspace: input.workspace,
      };
    },

    async listThreads() {
      return [];
    },
  };
  const threadActions: ThreadActionsService = {
    async create() {
      return {
        threadId: 'created-thread',
        workspace: 'workspace-1',
        title: null,
        updatedAt: null,
      };
    },

    async open(input) {
      return {
        status: 'ready',
        thread: {
          threadId: input.threadId,
          workspace: input.workspace,
          title: 'Thread one',
          updatedAt: '2026-04-29T00:00:00.000Z',
        },
        restoredItems: [],
      };
    },
  };
  const runtime: RuntimePort = {
    async send(input) {
      if (input.kind === 'resume-thread') {
        return {
          kind: 'thread-resumed',
          threadId: input.threadId,
          snapshot: {
            threadId: input.threadId,
            title: 'Thread one',
            items: [],
            pendingInputs: [],
          },
        };
      }

      throw new Error(`unexpected runtime command: ${input.kind}`);
    },
    subscribe() {
      return () => {};
    },
    async close() {},
  };

  return {
    conversation,
    runtime,
    slot: createSlotService({ events }),
    thread: createThreadService({ events }),
    threadActions,
    turn,
    workspace,
  };
}

describe('openClient', () => {
  test('opens a slot with null workspace and thread selection', async () => {
    const snapshot = await openClient({
      dependencies: createOpenClientDependencies(),
      input: {
        kind: 'open-client',
        payload: {},
        scope: {
          slotId: 'slot-1',
          threadId: null,
          workspaceId: null,
        },
      },
    });

    assert.equal(snapshot.identity.slotId, 'slot-1');
    assert.deepEqual(snapshot.selection, {
      threadId: null,
      workspaceId: null,
    });
    assert.equal(snapshot.workspace.status, 'none');
    assert.equal(snapshot.thread.status, 'none');
  });

  test('opens selected thread and presents its metadata', async () => {
    const snapshot = await openClient({
      dependencies: createOpenClientDependencies(),
      input: {
        kind: 'open-client',
        payload: {},
        scope: {
          slotId: 'slot-1',
          threadId: 'thread-1',
          workspaceId: 'workspace-1',
        },
      },
    });

    assert.deepEqual(snapshot.selection, {
      threadId: 'thread-1',
      workspaceId: 'workspace-1',
    });
    assert.equal(snapshot.workspace.status, 'selected');
    assert.equal(snapshot.thread.status, 'ready');
    assert.equal(snapshot.thread.title, 'Thread one');
    assert.equal(snapshot.stream.status, 'disabled');
  });
});
