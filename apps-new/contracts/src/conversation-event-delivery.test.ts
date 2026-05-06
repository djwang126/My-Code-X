import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { clientEventSchema } from './index.js';

describe('conversation event delivery contracts', () => {
  test('accepts an authoritative conversation replacement event', () => {
    const event = {
      kind: 'conversation-replaced',
      scope: {
        slotId: 'slot-1',
        threadId: 'thread-1',
      },
      revision: '2',
      conversation: {
        status: 'ready',
        revision: 2,
        items: [
          {
            id: 'user-1',
            kind: 'message',
            role: 'user',
            text: 'hello',
          },
          {
            id: 'assistant-1',
            kind: 'message',
            role: 'assistant',
            text: 'hi',
          },
        ],
      },
    };

    assert.deepEqual(clientEventSchema.parse(event), event);
  });

  test('accepts an authoritative conversation item upsert event for a conversation error', () => {
    const event = {
      kind: 'conversation-item-upserted',
      scope: {
        slotId: 'slot-1',
        threadId: 'thread-1',
      },
      revision: '3',
      item: {
        id: 'error:turn-1',
        kind: 'error',
        message: 'runtime failed',
      },
      position: { kind: 'append' },
    };

    assert.deepEqual(clientEventSchema.parse(event), event);
  });

  test('accepts an authoritative replacement event containing a conversation error item', () => {
    const event = {
      kind: 'conversation-replaced',
      scope: {
        slotId: 'slot-1',
        threadId: 'thread-1',
      },
      revision: '4',
      conversation: {
        status: 'ready',
        revision: 4,
        items: [
          {
            id: 'user-1',
            kind: 'message',
            role: 'user',
            text: 'hello',
          },
          {
            id: 'error:turn-1',
            kind: 'error',
            message: 'runtime failed',
          },
        ],
      },
    };

    assert.deepEqual(clientEventSchema.parse(event), event);
  });

  test('does not expose runtime delta events to the web protocol', () => {
    const parsed = clientEventSchema.safeParse({
      kind: 'conversation-item-delta',
      scope: {
        slotId: 'slot-1',
        threadId: 'thread-1',
      },
      revision: '2',
      itemId: 'assistant-1',
      text: 'partial token',
    });

    assert.equal(parsed.success, false);
  });

  test('does not expose partial item patch events to the web protocol', () => {
    const parsed = clientEventSchema.safeParse({
      kind: 'conversation-item-patched',
      scope: {
        slotId: 'slot-1',
        threadId: 'thread-1',
      },
      revision: '2',
      itemId: 'assistant-1',
      patch: {
        id: 'assistant-1',
        kind: 'message',
        role: 'assistant',
        text: 'partial',
      },
    });

    assert.equal(parsed.success, false);
  });

  test('rejects replacement events that do not carry a complete conversation view', () => {
    const parsed = clientEventSchema.safeParse({
      kind: 'conversation-replaced',
      scope: {
        slotId: 'slot-1',
        threadId: 'thread-1',
      },
      revision: '2',
      items: [
        {
          id: 'assistant-1',
          kind: 'message',
          role: 'assistant',
          text: 'missing conversation wrapper',
        },
      ],
    });

    assert.equal(parsed.success, false);
  });

  test('accepts replacement events that carry a failed conversation resource state', () => {
    const event = {
      kind: 'conversation-replaced',
      scope: {
        slotId: 'slot-1',
        threadId: 'thread-1',
      },
      revision: '2',
      conversation: {
        status: 'failed',
        revision: 2,
        error: {
          message: 'restore failed',
        },
      },
    };

    assert.deepEqual(clientEventSchema.parse(event), event);
  });

  test('accepts replacement events that carry a loading conversation resource state', () => {
    const event = {
      kind: 'conversation-replaced',
      scope: {
        slotId: 'slot-1',
        threadId: 'thread-1',
      },
      revision: '2',
      conversation: {
        status: 'loading',
        revision: 2,
      },
    };

    assert.deepEqual(clientEventSchema.parse(event), event);
  });

  test('rejects upsert events that carry delta-only fields', () => {
    const parsed = clientEventSchema.safeParse({
      kind: 'conversation-item-upserted',
      scope: {
        slotId: 'slot-1',
        threadId: 'thread-1',
      },
      revision: '2',
      itemId: 'assistant-1',
      text: 'partial token',
    });

    assert.equal(parsed.success, false);
  });
});
