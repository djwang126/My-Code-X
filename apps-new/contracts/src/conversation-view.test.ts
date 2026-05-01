import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { clientConversationViewSchema } from './conversation-view.js';

describe('client conversation view contract', () => {
  test('accepts loading state without timeline data or error', () => {
    assert.deepEqual(clientConversationViewSchema.parse({
      status: 'loading',
    }), {
      status: 'loading',
    });
  });

  test('accepts ready state with revision and ordered items', () => {
    assert.deepEqual(clientConversationViewSchema.parse({
      status: 'ready',
      revision: 2,
      items: [
        {
          id: 'item-1',
          text: 'hello',
        },
        {
          id: 'item-2',
          text: 'world',
        },
      ],
    }), {
      status: 'ready',
      revision: 2,
      items: [
        {
          id: 'item-1',
          text: 'hello',
        },
        {
          id: 'item-2',
          text: 'world',
        },
      ],
    });
  });

  test('represents empty conversation as ready with zero items', () => {
    assert.deepEqual(clientConversationViewSchema.parse({
      status: 'ready',
      revision: 0,
      items: [],
    }), {
      status: 'ready',
      revision: 0,
      items: [],
    });
  });

  test('requires failed state to carry a non-conversation error message', () => {
    assert.deepEqual(clientConversationViewSchema.parse({
      status: 'failed',
      error: {
        message: 'Unable to load conversation',
      },
    }), {
      status: 'failed',
      error: {
        message: 'Unable to load conversation',
      },
    });
  });

  test('does not allow restoring as a conversation view state', () => {
    const parsed = clientConversationViewSchema.safeParse({
      status: 'restoring',
    });

    assert.equal(parsed.success, false);
  });



  test('does not allow loading state to carry timeline items', () => {
    const parsed = clientConversationViewSchema.safeParse({
      status: 'loading',
      items: [],
    });

    assert.equal(parsed.success, false);
  });

  test('does not allow ready state to carry a non-conversation error', () => {
    const parsed = clientConversationViewSchema.safeParse({
      status: 'ready',
      revision: 0,
      items: [],
      error: {
        message: 'Unable to load conversation',
      },
    });

    assert.equal(parsed.success, false);
  });

  test('does not allow failed state to carry timeline items', () => {
    const parsed = clientConversationViewSchema.safeParse({
      status: 'failed',
      error: {
        message: 'Unable to load conversation',
      },
      items: [],
    });

    assert.equal(parsed.success, false);
  });

  test('does not allow out-of-scope conversation controls or timestamps', () => {
    const parsed = clientConversationViewSchema.safeParse({
      status: 'ready',
      revision: 0,
      items: [],
      timestamp: '2026-04-30T00:00:00.000Z',
      done: true,
      controls: {
        send: true,
        retry: true,
        approval: true,
      },
    });

    assert.equal(parsed.success, false);
  });

  test('does not allow failed state without an error message', () => {
    const parsed = clientConversationViewSchema.safeParse({
      status: 'failed',
    });

    assert.equal(parsed.success, false);
  });
});
