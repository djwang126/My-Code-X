import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createClientSnapshot, presentConversationItem, presentTurn } from './index.js';
import type { ConversationItem } from '../features/conversation/index.js';

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
      current: null,
    },
    conversation: {
      revision: 1,
      items: [
        {
          id: 'message-1',
          kind: 'message',
          role: 'user',
          text: 'hello',
        },
      ],
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
  assert.equal(snapshot.turn.current, null);
  assert.deepEqual(snapshot.conversation, {
    status: 'ready',
    revision: 1,
    items: [
      {
        id: 'message-1',
        kind: 'message',
        role: 'user',
        text: 'hello',
      },
    ],
  });
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
      current: null,
    },
    conversation: {
      revision: 0,
      items: [],
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

test('conversation presenter exposes confirmed message timeline items', () => {
  const item: ConversationItem = {
    id: 'item-1',
    kind: 'message',
    role: 'assistant',
    text: 'hello',
  };

  const presented = presentConversationItem({ item });

  assert.deepEqual(presented, {
    id: 'item-1',
    kind: 'message',
    role: 'assistant',
    text: 'hello',
  });
});

test('turn presenter exposes the native turn snapshot shape', () => {
  assert.deepEqual(presentTurn({
    snapshot: {
      current: {
        completedAt: null,
        durationMs: null,
        error: null,
        startedAt: null,
        status: 'inProgress',
        threadId: 'thread-1',
        turnId: 'turn-1',
      },
    },
  }), {
    current: {
      completedAt: null,
      durationMs: null,
      error: null,
      startedAt: null,
      status: 'inProgress',
      threadId: 'thread-1',
      turnId: 'turn-1',
    },
  });
});
