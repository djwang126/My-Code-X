import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createClientSnapshot, presentConversationItem, presentPendingInteraction, presentTurn } from './index.js';
import type { ConversationItem } from '../features/conversation/index.js';
import type { RuntimeRequest } from '../features/runtime-request/index.js';
import { SkeletonMigrationPendingError } from '../shared/index.js';

test('presenters create a client snapshot from feature-owned state', () => {
  const snapshot = createClientSnapshot({
    revision: 'rev-1',
    slot: {
      slotId: 'slot-1',
      workspace: 'workspace-1',
      threadId: 'thread-1',
    },
    selectedThread: {
      threadId: 'thread-1',
      workspace: 'workspace-1',
      title: 'Thread one',
      updatedAt: null,
    },
    turn: {
      lifecycle: 'idle',
      activeTurnId: null,
    },
    conversation: {
      revision: 1,
      items: [
        {
          id: 'message-1',
          text: 'hello',
        },
      ],
    },
    runtimeRequests: {
      requests: [],
    },
    workspace: {
      workspace: 'workspace-1',
      available: true,
    },
  });

  assert.equal(snapshot.identity.slotId, 'slot-1');
  assert.equal(snapshot.selection.workspaceId, 'workspace-1');
  assert.equal(snapshot.selection.threadId, 'thread-1');
  assert.equal(snapshot.thread.status, 'ready');
  assert.equal(snapshot.thread.title, 'Thread one');
  assert.equal(snapshot.turn.lifecycle, 'idle');
  assert.equal(snapshot.conversation.revision, 1);
  assert.equal(snapshot.conversation.items.length, 1);
  assert.equal(snapshot.stream.status, 'disabled');
});

test('client snapshot keeps slot selection separate from thread readiness', () => {
  const snapshot = createClientSnapshot({
    revision: 'rev-1',
    slot: {
      slotId: 'slot-1',
      workspace: 'workspace-1',
      threadId: 'selected-thread',
    },
    selectedThread: null,
    turn: {
      lifecycle: 'idle',
      activeTurnId: null,
    },
    conversation: {
      revision: 0,
      items: [],
    },
    runtimeRequests: {
      requests: [],
    },
    workspace: {
      workspace: 'workspace-1',
      available: true,
    },
  });

  assert.equal(snapshot.selection.threadId, 'selected-thread');
  assert.equal(snapshot.thread.status, 'none');
  assert.equal(snapshot.stream.status, 'disabled');
});

test('conversation presenter exposes only the skeleton timeline item shape', () => {
  const item: ConversationItem = {
    id: 'item-1',
    text: 'hello',
  };

  const presented = presentConversationItem({ item });

  assert.deepEqual(presented, {
    id: 'item-1',
    text: 'hello',
  });
});

test('pending interaction presenter stays explicit until controls are migrated', () => {
  const request: RuntimeRequest = {
    id: 'request-1',
    kind: 'approval',
    lifecycle: 'open',
    title: 'Approve action',
    prompt: 'Review before continuing',
    responseKind: 'decision',
    data: {},
  };

  assert.throws(
    () => presentPendingInteraction({ request }),
    SkeletonMigrationPendingError,
  );
});

test('turn presenter centralizes client send and interrupt affordances', () => {
  assert.deepEqual(presentTurn({ snapshot: { lifecycle: 'streaming', activeTurnId: 'turn-1' } }), {
    lifecycle: 'streaming',
    active: true,
    canSend: false,
    canInterrupt: true,
    visibleStatus: 'Running',
  });
});
