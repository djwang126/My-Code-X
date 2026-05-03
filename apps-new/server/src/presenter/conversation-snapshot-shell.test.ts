import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createClientSnapshot } from './create-client-snapshot.js';

function createSnapshotInput() {
  return {
    revision: 'rev-1',
    slot: {
      slotId: 'slot-1',
      workspace: null,
      threadId: null,
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
      workspace: null,
      available: false,
    },
  };
}

describe('conversation snapshot shell presenter', () => {
  test('presents empty conversation as ready resource state with zero items', () => {
    const snapshot = createClientSnapshot(createSnapshotInput());

    assert.deepEqual(snapshot.conversation, {
      status: 'ready',
      revision: 0,
      items: [],
    });
  });

  test('presents existing conversation as ready resource state with ordered items', () => {
    const snapshot = createClientSnapshot({
      ...createSnapshotInput(),
      conversation: {
        revision: 2,
        items: [
          {
            id: 'item-1',
            kind: 'message',
            role: 'user',
            text: 'hello **Codex**',
          },
          {
            id: 'item-2',
            kind: 'message',
            role: 'assistant',
            text: 'world',
          },
        ],
      },
    });

    assert.deepEqual(snapshot.conversation, {
      status: 'ready',
      revision: 2,
      items: [
        {
          id: 'item-1',
          kind: 'message',
          role: 'user',
          text: 'hello **Codex**',
        },
        {
          id: 'item-2',
          kind: 'message',
          role: 'assistant',
          text: 'world',
        },
      ],
    });
  });

  test('presents message raw markdown without rendered HTML or UI-only fields', () => {
    const snapshot = createClientSnapshot({
      ...createSnapshotInput(),
      conversation: {
        revision: 1,
        items: [
          {
            id: 'item-1',
            kind: 'message',
            role: 'assistant',
            text: 'Use `<button>` as text.',
          },
        ],
      },
    });

    assert.deepEqual(snapshot.conversation, {
      status: 'ready',
      revision: 1,
      items: [
        {
          id: 'item-1',
          kind: 'message',
          role: 'assistant',
          text: 'Use `<button>` as text.',
        },
      ],
    });
  });

  test('does not expose out-of-scope controls or timestamps in conversation snapshot', () => {
    const snapshot = createClientSnapshot(createSnapshotInput());

    assert.deepEqual(Object.keys(snapshot.conversation).sort(), [
      'items',
      'revision',
      'status',
    ]);
  });
});
