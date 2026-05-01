import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createConversationViewModelFromSnapshot } from './conversation-view-model.js';

describe('conversation view model', () => {
  test('maps loading snapshot to loading state', () => {
    assert.deepEqual(createConversationViewModelFromSnapshot({
      conversation: {
        status: 'loading',
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

  test('maps ready snapshot with items to timeline state', () => {
    assert.deepEqual(createConversationViewModelFromSnapshot({
      conversation: {
        status: 'ready',
        revision: 1,
        items: [
          {
            id: 'item-1',
            text: 'hello',
          },
        ],
      },
    }), {
      status: 'timeline',
      revision: 1,
      items: [
        {
          id: 'item-1',
          text: 'hello',
        },
      ],
    });
  });

  test('maps failed snapshot to non-timeline error state', () => {
    assert.deepEqual(createConversationViewModelFromSnapshot({
      conversation: {
        status: 'failed',
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
