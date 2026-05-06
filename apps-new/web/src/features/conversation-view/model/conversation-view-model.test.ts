import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createConversationViewModelFromSnapshot } from './conversation-view-model.js';

describe('conversation view model', () => {
  test('maps loading snapshot to loading state', () => {
    assert.deepEqual(createConversationViewModelFromSnapshot({
      conversation: {
        status: 'loading',
        revision: 0,
      },
    }), {
      status: 'loading',
    });
  });

  test('maps ready snapshot with zero items to empty state', () => {
    assert.deepEqual(createConversationViewModelFromSnapshot({
      conversation: {
        status: 'ready',
        revision: 0,
        items: [],
      },
    }), {
      status: 'empty',
      revision: 0,
    });
  });

  test('maps ready snapshot with confirmed message items to timeline state', () => {
    assert.deepEqual(createConversationViewModelFromSnapshot({
      conversation: {
        status: 'ready',
        revision: 1,
        items: [
          {
            id: 'item-1',
            kind: 'message',
            role: 'user',
            text: 'hello **Codex**\n<script>alert(1)</script>',
          },
          {
            id: 'item-2',
            kind: 'message',
            role: 'assistant',
            text: 'world',
          },
        ],
      },
    }), {
      status: 'timeline',
      revision: 1,
      items: [
        {
          id: 'item-1',
          kind: 'message',
          role: 'user',
          text: 'hello **Codex**\n<script>alert(1)</script>',
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

  test('maps failed snapshot to non-timeline error state', () => {
    assert.deepEqual(createConversationViewModelFromSnapshot({
      conversation: {
        status: 'failed',
        revision: 2,
        error: {
          message: 'Unable to load conversation',
        },
      },
    }), {
      status: 'failed',
      error: {
        message: 'Unable to load conversation',
      },
    });
  });
});
