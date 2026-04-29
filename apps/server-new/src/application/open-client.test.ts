import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { openClient } from './open-client.js';
import type { ConversationService } from '../features/conversation/index.js';
import type { RuntimeRequestService } from '../features/runtime-request/index.js';
import { createSlotService } from '../features/slot/index.js';
import type { ThreadService } from '../features/thread/index.js';
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
      return { items: [] };
    },
    snapshot() {
      return { items: [] };
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
  const thread: ThreadService = {
    async start() {
      return {
        activeTurnId: null,
        currentThreadId: null,
        threads: [],
      };
    },
    receiveRuntimeEvent() {},
    snapshot() {
      return {
        activeTurnId: null,
        currentThreadId: null,
        threads: [],
      };
    },
  };
  const turn: TurnService = {
    apply() {
      return {
        activeTurnId: null,
        lifecycle: 'idle',
      };
    },
    snapshot() {
      return {
        activeTurnId: null,
        lifecycle: 'idle',
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
  };

  return {
    conversation,
    runtimeRequests,
    slot: createSlotService({ events }),
    thread,
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

  test('preserves slot thread selection before thread resume is migrated', async () => {
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
    assert.equal(snapshot.thread.status, 'none');
    assert.equal(snapshot.stream.status, 'disabled');
  });
});
