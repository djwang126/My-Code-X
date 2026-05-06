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
        position: { kind: 'append' },
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
        position: { kind: 'append' },
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

  test('upsert appends a work trace timeline item in event order', () => {
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
          id: 'plan-1',
          kind: 'work-trace',
          codexType: 'plan',
          fields: [
            { name: 'type', value: 'plan' },
          ],
        },
        position: { kind: 'append' },
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
          id: 'plan-1',
          kind: 'work-trace',
          codexType: 'plan',
          fields: [
            { name: 'type', value: 'plan' },
          ],
        },
      ],
    });
  });

  test('upsert updates an existing work trace item without duplicating it', () => {
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
            id: 'command-1',
            kind: 'work-trace',
            codexType: 'commandExecution',
            fields: [
              { name: 'status', value: 'in-progress' },
            ],
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
          id: 'command-1',
          kind: 'work-trace',
          codexType: 'commandExecution',
          fields: [
            { name: 'status', value: 'completed' },
            { name: 'aggregatedOutput', value: 'ok' },
          ],
        },
        position: { kind: 'append' },
      },
    });

    assert.deepEqual(conversation, {
      status: 'ready',
      revision: 2,
      items: [
        {
          id: 'command-1',
          kind: 'work-trace',
          codexType: 'commandExecution',
          fields: [
            { name: 'status', value: 'completed' },
            { name: 'aggregatedOutput', value: 'ok' },
          ],
        },
      ],
    });
  });

  test('upsert appends a conversation error item in event order', () => {
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
          id: 'error:turn-1',
          kind: 'error',
          message: 'runtime failed',
        },
        position: { kind: 'append' },
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
          id: 'error:turn-1',
          kind: 'error',
          message: 'runtime failed',
        },
      ],
    });
  });

  test('upsert updates an existing conversation error item without duplicating it', () => {
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
            id: 'error:turn-1',
            kind: 'error',
            message: 'first error',
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
          id: 'error:turn-1',
          kind: 'error',
          message: 'final error',
        },
        position: { kind: 'append' },
      },
    });

    assert.deepEqual(conversation, {
      status: 'ready',
      revision: 2,
      items: [
        {
          id: 'error:turn-1',
          kind: 'error',
          message: 'final error',
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

  test('replacement rebuilds the timeline with unknown fallback items preserved as unknown', () => {
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
              id: 'future-1',
              kind: 'unknown',
              codexType: 'futureCodexItem',
              fields: [
                { name: 'type', value: 'futureCodexItem' },
                { name: 'payload', value: { nested: true } },
              ],
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
          id: 'future-1',
          kind: 'unknown',
          codexType: 'futureCodexItem',
          fields: [
            { name: 'type', value: 'futureCodexItem' },
            { name: 'payload', value: { nested: true } },
          ],
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
        position: { kind: 'append' },
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
        position: { kind: 'append' },
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
        position: { kind: 'append' },
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
        position: { kind: 'append' },
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
        position: { kind: 'append' },
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

  test('ignores stale ready replacement events that would overwrite a newer failed state', () => {
    const conversation = applyConversationClientEvent({
      scope: {
        slotId: 'slot-1',
        threadId: 'thread-1',
      },
      conversation: {
        status: 'failed',
        revision: 3,
        error: {
          message: 'restore failed',
        },
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
          items: [],
        },
      },
    });

    assert.deepEqual(conversation, {
      status: 'failed',
      revision: 3,
      error: {
        message: 'restore failed',
      },
    });
  });

  test('applies newer ready replacement events after a failed state', () => {
    const conversation = applyConversationClientEvent({
      scope: {
        slotId: 'slot-1',
        threadId: 'thread-1',
      },
      conversation: {
        status: 'failed',
        revision: 3,
        error: {
          message: 'restore failed',
        },
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
              id: 'assistant-1',
              kind: 'message',
              role: 'assistant',
              text: 'restored',
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
          id: 'assistant-1',
          kind: 'message',
          role: 'assistant',
          text: 'restored',
        },
      ],
    });
  });

  test('ignores replacement events when event revision and conversation revision disagree', () => {
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
          revision: 2,
          items: [
            {
              id: 'assistant-mismatched',
              kind: 'message',
              role: 'assistant',
              text: 'should not apply',
            },
          ],
        },
      },
    });

    assert.deepEqual(conversation, {
      status: 'ready',
      revision: 3,
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

  test('ignores item upsert events while conversation is failed', () => {
    const conversation = applyConversationClientEvent({
      scope: {
        slotId: 'slot-1',
        threadId: 'thread-1',
      },
      conversation: {
        status: 'failed',
        revision: 3,
        error: {
          message: 'restore failed',
        },
      },
      event: {
        kind: 'conversation-item-upserted',
        scope: {
          slotId: 'slot-1',
          threadId: 'thread-1',
        },
        revision: '4',
        item: {
          id: 'assistant-1',
          kind: 'message',
          role: 'assistant',
          text: 'should wait for replacement',
        },
        position: { kind: 'append' },
      },
    });

    assert.deepEqual(conversation, {
      status: 'failed',
      revision: 3,
      error: {
        message: 'restore failed',
      },
    });
  });
});


describe('conversation event reducer timeline positions', () => {
  test('inserts new item before server-selected target item', () => {
    const conversation = applyConversationClientEvent({
      scope: { slotId: 'slot-1', threadId: 'thread-1' },
      conversation: {
        status: 'ready',
        revision: 1,
        items: [
          {
            id: 'command-1',
            kind: 'work-trace',
            codexType: 'commandExecution',
            fields: [],
          },
        ],
      },
      event: {
        kind: 'conversation-item-upserted',
        scope: { slotId: 'slot-1', threadId: 'thread-1' },
        revision: '2',
        item: {
          id: 'assistant-1',
          kind: 'message',
          role: 'assistant',
          text: 'hello',
        },
        position: { kind: 'before-item', itemId: 'command-1' },
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
          text: 'hello',
        },
        {
          id: 'command-1',
          kind: 'work-trace',
          codexType: 'commandExecution',
          fields: [],
        },
      ],
    });
  });

  test('ignores positioned upsert when target item is missing', () => {
    const current = {
      status: 'ready' as const,
      revision: 1,
      items: [
        {
          id: 'command-1',
          kind: 'work-trace' as const,
          codexType: 'commandExecution',
          fields: [],
        },
      ],
    };
    const conversation = applyConversationClientEvent({
      scope: { slotId: 'slot-1', threadId: 'thread-1' },
      conversation: current,
      event: {
        kind: 'conversation-item-upserted',
        scope: { slotId: 'slot-1', threadId: 'thread-1' },
        revision: '2',
        item: {
          id: 'assistant-1',
          kind: 'message',
          role: 'assistant',
          text: 'hello',
        },
        position: { kind: 'before-item', itemId: 'missing' },
      },
    });

    assert.deepEqual(conversation, current);
  });
});
