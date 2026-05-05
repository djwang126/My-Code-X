import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createClientEventStream } from './client-event-stream.js';
import { createConversationService } from '../features/conversation/index.js';
import type { ClientEvent } from '@my-code-x/contracts-new';
import type { DomainEvent, DomainEventHandler, EventBusPort, Unsubscribe } from '../ports/index.js';

describe('client event stream', () => {
  test('delivers scoped conversation upsert events as client events', () => {
    const events = createEventBus();
    const stream = createClientEventStream({ conversation: createConversationService({ events }), events });
    const sent: ClientEvent[] = [];

    stream.subscribe({
      scope: {
        slotId: 'slot-1',
        threadId: 'thread-1',
      },
      send(event) {
        sent.push(event);
      },
    });

    events.publish({
      kind: 'conversation-item-upserted',
      threadId: 'thread-1',
      revision: 2,
      item: {
        id: 'assistant-1',
        kind: 'message',
        role: 'assistant',
        text: 'hello',
      },
    });

    assert.deepEqual(sent, [
      createEmptyReplacement(),
      {
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
          text: 'hello',
        },
      },
    ]);
  });

  test('ignores conversation events for another thread', () => {
    const events = createEventBus();
    const stream = createClientEventStream({ conversation: createConversationService({ events }), events });
    const sent: ClientEvent[] = [];

    stream.subscribe({
      scope: {
        slotId: 'slot-1',
        threadId: 'thread-1',
      },
      send(event) {
        sent.push(event);
      },
    });

    events.publish({
      kind: 'conversation-item-upserted',
      threadId: 'thread-2',
      revision: 2,
      item: {
        id: 'assistant-2',
        kind: 'message',
        role: 'assistant',
        text: 'other',
      },
    });

    assert.deepEqual(sent, [
      createEmptyReplacement(),
    ]);
  });

  test('stops delivering events after unsubscribe', () => {
    const events = createEventBus();
    const stream = createClientEventStream({ conversation: createConversationService({ events }), events });
    const sent: ClientEvent[] = [];

    const unsubscribe = stream.subscribe({
      scope: {
        slotId: 'slot-1',
        threadId: 'thread-1',
      },
      send(event) {
        sent.push(event);
      },
    });

    unsubscribe();
    events.publish({
      kind: 'conversation-item-upserted',
      threadId: 'thread-1',
      revision: 2,
      item: {
        id: 'assistant-1',
        kind: 'message',
        role: 'assistant',
        text: 'hello',
      },
    });

    assert.deepEqual(sent, [
      createEmptyReplacement(),
    ]);
  });
  test('delivers real conversation service events with thread scope and revision', () => {
    const events = createEventBus();
    const conversation = createConversationService({ events });
    const stream = createClientEventStream({ conversation, events });
    const sent: ClientEvent[] = [];

    stream.subscribe({
      scope: {
        slotId: 'slot-1',
        threadId: 'thread-1',
      },
      send(event) {
        sent.push(event);
      },
    });

    conversation.apply({
      kind: 'record-runtime-thread-item',
      threadId: 'thread-1',
      item: {
        itemId: 'assistant-1',
        itemKind: 'agentMessage',
        status: 'completed',
        text: 'real event',
        phase: null,
        memoryCitation: null,
      },
    });

    assert.deepEqual(sent, [
      createEmptyReplacement(),
      {
        kind: 'conversation-item-upserted',
        scope: {
          slotId: 'slot-1',
          threadId: 'thread-1',
        },
        revision: '1',
        item: {
          id: 'assistant-1',
          kind: 'message',
          role: 'assistant',
          text: 'real event',
        },
      },
    ]);
  });

  test('delivers scoped conversation error upsert events as client events', () => {
    const events = createEventBus();
    const stream = createClientEventStream({ conversation: createConversationService({ events }), events });
    const sent: ClientEvent[] = [];

    stream.subscribe({
      scope: {
        slotId: 'slot-1',
        threadId: 'thread-1',
      },
      send(event) {
        sent.push(event);
      },
    });

    events.publish({
      kind: 'conversation-item-upserted',
      threadId: 'thread-1',
      revision: 2,
      item: {
        id: 'error:turn-1',
        kind: 'error',
        message: 'runtime failed',
      },
    });

    assert.deepEqual(sent, [
      createEmptyReplacement(),
      {
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
      },
    ]);
  });

  test('sends the current authoritative conversation when subscribing', () => {
    const events = createEventBus();
    const conversation = createConversationService({ events });
    conversation.apply({
      kind: 'replace-conversation',
      threadId: 'thread-1',
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
    const stream = createClientEventStream({ conversation, events });
    const sent: ClientEvent[] = [];

    stream.subscribe({
      scope: {
        slotId: 'slot-1',
        threadId: 'thread-1',
      },
      send(event) {
        sent.push(event);
      },
    });

    assert.deepEqual(sent, [
      {
        kind: 'conversation-replaced',
        scope: {
          slotId: 'slot-1',
          threadId: 'thread-1',
        },
        revision: '1',
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
            {
              id: 'assistant-1',
              kind: 'message',
              role: 'assistant',
              text: 'hi',
            },
          ],
        },
      },
    ]);
  });

  test('sends current authoritative conversations containing error items when subscribing', () => {
    const events = createEventBus();
    const conversation = createConversationService({ events });
    conversation.apply({
      kind: 'replace-conversation',
      threadId: 'thread-1',
      items: [
        {
          id: 'error:turn-1',
          kind: 'error',
          message: 'runtime failed',
        },
      ],
    });
    const stream = createClientEventStream({ conversation, events });
    const sent: ClientEvent[] = [];

    stream.subscribe({
      scope: {
        slotId: 'slot-1',
        threadId: 'thread-1',
      },
      send(event) {
        sent.push(event);
      },
    });

    assert.deepEqual(sent, [
      {
        kind: 'conversation-replaced',
        scope: {
          slotId: 'slot-1',
          threadId: 'thread-1',
        },
        revision: '1',
        conversation: {
          status: 'ready',
          revision: 1,
          items: [
            {
              id: 'error:turn-1',
              kind: 'error',
              message: 'runtime failed',
            },
          ],
        },
      },
    ]);
  });
});

function createEmptyReplacement(): ClientEvent {
  return {
    kind: 'conversation-replaced',
    scope: {
      slotId: 'slot-1',
      threadId: 'thread-1',
    },
    revision: '0',
    conversation: {
      status: 'ready',
      revision: 0,
      items: [],
    },
  };
}

function createEventBus(): EventBusPort {
  const handlers = new Set<DomainEventHandler>();

  return {
    publish(event: DomainEvent) {
      for (const handler of handlers) {
        handler(event);
      }
    },

    subscribe(handler: DomainEventHandler): Unsubscribe {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
  };
}


