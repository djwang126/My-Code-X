import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createFailedConversationView } from './app-conversation-state.js';

describe('app shell conversation state transitions', () => {
  test('event stream failures preserve the current conversation revision', () => {
    assert.deepEqual(createFailedConversationView({
      current: {
        status: 'ready',
        revision: 5,
        items: [
          {
            id: 'assistant-1',
            kind: 'message',
            role: 'assistant',
            text: 'current',
          },
        ],
      },
      error: new Error('Invalid client event payload'),
    }), {
      status: 'failed',
      revision: 5,
      error: {
        message: 'Invalid client event payload',
      },
    });
  });
});
