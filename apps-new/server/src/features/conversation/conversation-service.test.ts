import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createConversationService } from './conversation-service.js';
import type { ConversationDomainEvent } from './conversation-events.js';

describe('createConversationService', () => {
  test('starts with an empty timeline at revision zero', () => {
    const service = createConversationService({
      events: {
        publish() {},
        subscribe() {
          return () => {};
        },
      },
    });

    assert.deepEqual(service.snapshot(), {
      revision: 0,
      items: [],
    });
  });

  test('replaces and appends timeline items while advancing revision', () => {
    const events: ConversationDomainEvent[] = [];
    const service = createConversationService({
      events: {
        publish(event) {
          events.push(event as ConversationDomainEvent);
        },
        subscribe() {
          return () => {};
        },
      },
    });

    assert.deepEqual(
      service.apply({
        kind: 'replace-conversation',
        items: [{ id: 'item-1', text: 'hello' }],
      }),
      {
        revision: 1,
        items: [{ id: 'item-1', text: 'hello' }],
      },
    );

    assert.deepEqual(
      service.apply({
        kind: 'append-conversation-item',
        item: { id: 'item-2', text: 'world' },
      }),
      {
        revision: 2,
        items: [
          { id: 'item-1', text: 'hello' },
          { id: 'item-2', text: 'world' },
        ],
      },
    );

    assert.deepEqual(events, [
      {
        kind: 'conversation-replaced',
        items: [{ id: 'item-1', text: 'hello' }],
      },
      {
        kind: 'conversation-item-appended',
        item: { id: 'item-2', text: 'world' },
      },
    ]);
  });
});
