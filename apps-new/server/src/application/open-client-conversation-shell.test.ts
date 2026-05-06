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
      return { status: 'ready', revision: 0, items: [] };
    },
    snapshot() {
      return { status: 'ready', revision: 0, items: [] };
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
    async inspectSavedWorkspace(input) {
      if (!input.workspaceId) {
        return { status: 'none' };
      }

      return {
        status: 'available',
        workspaceId: input.workspaceId,
      };
    },

    async openList() {
      return {
        persistence: { status: 'persistent' },
        selectedWorkspaceId: null,
        items: [],
      };
    },

    async add() {
      return {
        persistence: { status: 'persistent' },
        selectedWorkspaceId: null,
        items: [],
      };
    },

    async rename() {
      return {
        persistence: { status: 'persistent' },
        selectedWorkspaceId: null,
        items: [],
      };
    },

    async editCwd() {
      return {
        persistence: { status: 'persistent' },
        selectedWorkspaceId: null,
        items: [],
      };
    },

    async remove() {
      return {
        persistence: { status: 'persistent' },
        selectedWorkspaceId: null,
        items: [],
      };
    },
  };
  const threadActions: ThreadActionsService = {
    async create() {
      return {
        threadId: 'created-thread',
        workspace: 'workspace-1',
        name: null,
        updatedAt: null,
      };
    },

    async open(input) {
      return {
        status: 'ready',
        thread: {
          threadId: input.threadId,
          workspace: input.workspace,
          name: 'Thread one',
          updatedAt: null,
        },
        restoredItems: [],
        restoredTurns: null,
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
            name: 'Thread one',
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

describe('openClient conversation snapshot shell', () => {
  test('returns a ready empty conversation view for an opened client with no timeline items', async () => {
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

    assert.deepEqual(snapshot.conversation, {
      status: 'ready',
      revision: 0,
      items: [],
    });
  });
});
