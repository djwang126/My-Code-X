import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { applyConversationClientEvent } from './conversation-event-reducer.js';

describe('conversation client event reducer', () => {
  test('upsert updates an existing timeline item without duplicating it', () => {
    const conversation = applyConversationClientEvent({
      scope: {
        slotId: 'slot-1',
        threadId: 'thread-1',
      },
      conversation: {
        status: 'ready',
        revision: 1,
        items: [
          {
            id: 'assistant-1',
            kind: 'message',
            role: 'assistant',
            text: 'draft',
          },
        ],
      },
      event: {
        kind: 'conversation-item-upserted',
        scope: {
          slotId: 'slot-1',
          threadId: 'thread-1',
        },
        revision: '2',
        item: {
          id: 'assistant-1',
          kind: 'message',
          role: 'assistant',
          text: 'final',
        },
      },
    });

    assert.deepEqual(conversation, {
      status: 'ready',
      revision: 2,
      items: [
        {
          id: 'assistant-1',
          kind: 'message',
          role: 'assistant',
          text: 'final',
        },
      ],
    });
  });

  test('upsert appends a new timeline item in event order', () => {
    const conversation = applyConversationClientEvent({
      scope: {
        slotId: 'slot-1',
        threadId: 'thread-1',
      },
      conversation: {
        status: 'ready',
        revision: 1,
        items: [
          {
            id: 'user-1',
            kind: 'message',
            role: 'user',
            text: 'hello',
          },
        ],
      },
      event: {
        kind: 'conversation-item-upserted',
        scope: {
          slotId: 'slot-1',
          threadId: 'thread-1',
        },
        revision: '2',
        item: {
          id: 'assistant-1',
          kind: 'message',
          role: 'assistant',
          text: 'hi',
        },
      },
    });

    assert.deepEqual(conversation, {
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
    });
  });

  test('replacement rebuilds the complete local timeline', () => {
    const conversation = applyConversationClientEvent({
      scope: {
        slotId: 'slot-1',
        threadId: 'thread-1',
      },
      conversation: {
        status: 'ready',
        revision: 1,
        items: [
          {
            id: 'old-item',
            kind: 'message',
            role: 'assistant',
            text: 'old',
          },
        ],
      },
      event: {
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
              id: 'user-restored',
              kind: 'message',
              role: 'user',
              text: 'restored hello',
            },
            {
              id: 'assistant-restored',
              kind: 'message',
              role: 'assistant',
              text: 'restored hi',
            },
          ],
        },
      },
    });

    assert.deepEqual(conversation, {
      status: 'ready',
      revision: 2,
      items: [
        {
          id: 'user-restored',
          kind: 'message',
          role: 'user',
          text: 'restored hello',
        },
        {
          id: 'assistant-restored',
          kind: 'message',
          role: 'assistant',
          text: 'restored hi',
        },
      ],
    });
  });

  test('ignores events for another thread', () => {
    const conversation = applyConversationClientEvent({
      scope: {
        slotId: 'slot-1',
        threadId: 'thread-1',
      },
      conversation: {
        status: 'ready',
        revision: 1,
        items: [
          {
            id: 'assistant-1',
            kind: 'message',
            role: 'assistant',
            text: 'current',
          },
        ],
      },
      event: {
        kind: 'conversation-item-upserted',
        scope: {
          slotId: 'slot-1',
          threadId: 'thread-2',
        },
        revision: '2',
        item: {
          id: 'assistant-2',
          kind: 'message',
          role: 'assistant',
          text: 'other',
        },
      },
    });

    assert.deepEqual(conversation, {
      status: 'ready',
      revision: 1,
      items: [
        {
          id: 'assistant-1',
          kind: 'message',
          role: 'assistant',
          text: 'current',
        },
      ],
    });
  });

  test('ignores events for another slot', () => {
    const conversation = applyConversationClientEvent({
      scope: {
        slotId: 'slot-1',
        threadId: 'thread-1',
      },
      conversation: {
        status: 'ready',
        revision: 1,
        items: [],
      },
      event: {
        kind: 'conversation-item-upserted',
        scope: {
          slotId: 'slot-2',
          threadId: 'thread-1',
        },
        revision: '2',
        item: {
          id: 'assistant-1',
          kind: 'message',
          role: 'assistant',
          text: 'other slot',
        },
      },
    });

    assert.deepEqual(conversation, {
      status: 'ready',
      revision: 1,
      items: [],
    });
  });

  test('ignores stale upsert events that would roll back the current conversation', () => {
    const conversation = applyConversationClientEvent({
      scope: {
        slotId: 'slot-1',
        threadId: 'thread-1',
      },
      conversation: {
        status: 'ready',
        revision: 3,
        items: [
          {
            id: 'assistant-1',
            kind: 'message',
            role: 'assistant',
            text: 'current',
          },
        ],
      },
      event: {
        kind: 'conversation-item-upserted',
        scope: {
          slotId: 'slot-1',
          threadId: 'thread-1',
        },
        revision: '2',
        item: {
          id: 'assistant-1',
          kind: 'message',
          role: 'assistant',
          text: 'stale',
        },
      },
    });

    assert.deepEqual(conversation, {
      status: 'ready',
      revision: 3,
      items: [
        {
          id: 'assistant-1',
          kind: 'message',
          role: 'assistant',
          text: 'current',
        },
      ],
    });
  });

  test('ignores same-revision upsert events that would rewrite the current conversation', () => {
    const conversation = applyConversationClientEvent({
      scope: {
        slotId: 'slot-1',
        threadId: 'thread-1',
      },
      conversation: {
        status: 'ready',
        revision: 3,
        items: [
          {
            id: 'assistant-1',
            kind: 'message',
            role: 'assistant',
            text: 'current',
          },
        ],
      },
      event: {
        kind: 'conversation-item-upserted',
        scope: {
          slotId: 'slot-1',
          threadId: 'thread-1',
        },
        revision: '3',
        item: {
          id: 'assistant-1',
          kind: 'message',
          role: 'assistant',
          text: 'same revision rewrite',
        },
      },
    });

    assert.deepEqual(conversation, {
      status: 'ready',
      revision: 3,
      items: [
        {
          id: 'assistant-1',
          kind: 'message',
          role: 'assistant',
          text: 'current',
        },
      ],
    });
  });

  test('ignores stale replacement events that would roll back the current timeline', () => {
    const conversation = applyConversationClientEvent({
      scope: {
        slotId: 'slot-1',
        threadId: 'thread-1',
      },
      conversation: {
        status: 'ready',
        revision: 4,
        items: [
          {
            id: 'assistant-current',
            kind: 'message',
            role: 'assistant',
            text: 'current',
          },
        ],
      },
      event: {
        kind: 'conversation-replaced',
        scope: {
          slotId: 'slot-1',
          threadId: 'thread-1',
        },
        revision: '3',
        conversation: {
          status: 'ready',
          revision: 3,
          items: [
            {
              id: 'assistant-stale',
              kind: 'message',
              role: 'assistant',
              text: 'stale',
            },
          ],
        },
      },
    });

    assert.deepEqual(conversation, {
      status: 'ready',
      revision: 4,
      items: [
        {
          id: 'assistant-current',
          kind: 'message',
          role: 'assistant',
          text: 'current',
        },
      ],
    });
  });

  test('ignores same-revision replacement events that would rewrite the current timeline', () => {
    const conversation = applyConversationClientEvent({
      scope: {
        slotId: 'slot-1',
        threadId: 'thread-1',
      },
      conversation: {
        status: 'ready',
        revision: 4,
        items: [
          {
            id: 'assistant-current',
            kind: 'message',
            role: 'assistant',
            text: 'current',
          },
        ],
      },
      event: {
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
              id: 'assistant-same-revision',
              kind: 'message',
              role: 'assistant',
              text: 'same revision rewrite',
            },
          ],
        },
      },
    });

    assert.deepEqual(conversation, {
      status: 'ready',
      revision: 4,
      items: [
        {
          id: 'assistant-current',
          kind: 'message',
          role: 'assistant',
          text: 'current',
        },
      ],
    });
  });

  test('ignores upsert events with a non-numeric conversation revision', () => {
    const conversation = applyConversationClientEvent({
      scope: {
        slotId: 'slot-1',
        threadId: 'thread-1',
      },
      conversation: {
        status: 'ready',
        revision: 1,
        items: [
          {
            id: 'assistant-1',
            kind: 'message',
            role: 'assistant',
            text: 'current',
          },
        ],
      },
      event: {
        kind: 'conversation-item-upserted',
        scope: {
          slotId: 'slot-1',
          threadId: 'thread-1',
        },
        revision: '2abc',
        item: {
          id: 'assistant-1',
          kind: 'message',
          role: 'assistant',
          text: 'should not apply',
        },
      },
    });

    assert.deepEqual(conversation, {
      status: 'ready',
      revision: 1,
      items: [
        {
          id: 'assistant-1',
          kind: 'message',
          role: 'assistant',
          text: 'current',
        },
      ],
    });
  });
});
