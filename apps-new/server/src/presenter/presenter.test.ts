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
    thread: {
      currentThreadId: 'thread-1',
      activeTurnId: null,
      threads: [],
    },
    turn: {
      lifecycle: 'idle',
      activeTurnId: null,
    },
    conversation: {
      items: [
        {
          id: 'message-1',
          kind: 'message',
          lifecycle: 'complete',
          text: 'hello',
          role: 'user',
          title: null,
          detailId: null,
          detailRevision: null,
          data: {},
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
  assert.equal(snapshot.turn.lifecycle, 'idle');
  assert.equal(snapshot.conversation.items.length, 1);
  assert.equal(snapshot.stream.status, 'available');
});

test('client snapshot keeps slot selection separate from thread readiness', () => {
  const snapshot = createClientSnapshot({
    revision: 'rev-1',
    slot: {
      slotId: 'slot-1',
      workspace: 'workspace-1',
      threadId: 'selected-thread',
    },
    thread: {
      currentThreadId: null,
      activeTurnId: null,
      threads: [],
    },
    turn: {
      lifecycle: 'idle',
      activeTurnId: null,
    },
    conversation: {
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

test('conversation presenter hides storage shape behind client item kinds', () => {
  const item: ConversationItem = {
    id: 'command-1',
    kind: 'command',
    lifecycle: 'running',
    text: 'npm test',
    role: null,
    title: 'Command',
    detailId: 'detail-1',
    detailRevision: 'rev-1',
    data: {},
  };

  const presented = presentConversationItem({ item });

  assert.equal(presented.kind, 'command');
  assert.equal(presented.body.kind, 'structured');
  assert.equal(presented.detail.kind, 'deferred');
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
