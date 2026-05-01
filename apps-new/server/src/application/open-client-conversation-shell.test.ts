import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { openClient } from './open-client.js';
import type { ConversationService } from '../features/conversation/index.js';
import type { RuntimeRequestService } from '../features/runtime-request/index.js';
import { createSlotService } from '../features/slot/index.js';
import type { ThreadActionsService } from '../features/thread-actions/index.js';
import { createThreadService } from '../features/thread/index.js';
import type { TurnService } from '../features/turn/index.js';
import type { WorkspaceService } from '../features/workspace/index.js';
import type { DomainEvent, EventBusPort } from '../ports/index.js';

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
  const runtimeRequests: RuntimeRequestService = {
    apply() {
      return { requests: [] };
    },
    snapshot() {
      return { requests: [] };
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
        threadId: input.threadId,
        workspace: input.workspace,
        title: 'Thread one',
        updatedAt: null,
      };
    },
  };

  return {
    conversation,
    runtimeRequests,
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
