import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createConversationService } from './conversation-service.js';
import type { ConversationDomainEvent } from './conversation-events.js';
import type { RuntimeThreadItem } from '../../ports/index.js';

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

    assert.deepEqual(service.snapshot({ threadId: 'thread-1' }), {
      revision: 0,
      items: [],
    });
  });

  test('replace-conversation publishes an authoritative replacement event', () => {
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
        threadId: 'thread-1',
        items: [
          {
            id: 'item-1',
            kind: 'message',
            role: 'user',
            text: 'hello **assistant**',
          },
        ],
      }),
      {
        revision: 1,
        items: [
          {
            id: 'item-1',
            kind: 'message',
            role: 'user',
            text: 'hello **assistant**',
          },
        ],
      },
    );

    assert.deepEqual(events, [
      {
        kind: 'conversation-replaced',
        threadId: 'thread-1',
        revision: 1,
        items: [
          {
            id: 'item-1',
            kind: 'message',
            role: 'user',
            text: 'hello **assistant**',
          },
        ],
      },
    ]);
  });

  test('projects runtime user and assistant messages inside the conversation feature', () => {
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

    service.apply({
      kind: 'record-runtime-thread-item',
      threadId: 'thread-1',
      item: createRuntimeUserMessage({
        itemId: 'item-1',
        text: 'hello',
      }),
    });
    service.apply({
      kind: 'record-runtime-thread-item',
      threadId: 'thread-1',
      item: createRuntimeAgentMessage({
        itemId: 'item-2',
        text: 'world',
      }),
    });

    assert.deepEqual(service.snapshot({ threadId: 'thread-1' }), {
      revision: 2,
      items: [
        {
          id: 'item-1',
          kind: 'message',
          role: 'user',
          text: 'hello',
        },
        {
          id: 'item-2',
          kind: 'message',
          role: 'assistant',
          text: 'world',
        },
      ],
    });
    assert.deepEqual(events, [
      {
        kind: 'conversation-item-upserted',
        threadId: 'thread-1',
        revision: 1,
        item: {
          id: 'item-1',
          kind: 'message',
          role: 'user',
          text: 'hello',
        },
      },
      {
        kind: 'conversation-item-upserted',
        threadId: 'thread-1',
        revision: 2,
        item: {
          id: 'item-2',
          kind: 'message',
          role: 'assistant',
          text: 'world',
        },
      },
    ]);
  });

  test('does not project user or assistant runtime items without text', () => {
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

    service.apply({
      kind: 'record-runtime-thread-item',
      threadId: 'thread-1',
      item: createRuntimeUserMessage({
        itemId: 'item-1',
        text: null,
      }),
    });
    service.apply({
      kind: 'record-runtime-thread-item',
      threadId: 'thread-1',
      item: createRuntimeAgentMessage({
        itemId: 'item-2',
        text: null,
      }),
    });

    assert.deepEqual(service.snapshot({ threadId: 'thread-1' }), {
      revision: 0,
      items: [],
    });
    assert.deepEqual(events, []);
  });

  test('replace-runtime-conversation keeps confirmed messages in order and filters work traces', () => {
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
        kind: 'replace-runtime-conversation',
        threadId: 'thread-1',
        items: [
          createRuntimeUserMessage({
            itemId: 'user-1',
            text: 'restored hello',
          }),
          createRuntimePlanItem({
            itemId: 'plan-1',
            text: 'Plan',
          }),
          createRuntimeAgentMessage({
            itemId: 'assistant-1',
            text: 'restored answer',
          }),
        ],
      }),
      {
        revision: 1,
        items: [
          {
            id: 'user-1',
            kind: 'message',
            role: 'user',
            text: 'restored hello',
          },
          {
            id: 'assistant-1',
            kind: 'message',
            role: 'assistant',
            text: 'restored answer',
          },
        ],
      },
    );
    assert.deepEqual(events, [
      {
        kind: 'conversation-replaced',
        threadId: 'thread-1',
        revision: 1,
        items: [
          {
            id: 'user-1',
            kind: 'message',
            role: 'user',
            text: 'restored hello',
          },
          {
            id: 'assistant-1',
            kind: 'message',
            role: 'assistant',
            text: 'restored answer',
          },
        ],
      },
    ]);
  });

  test('replace-runtime-conversation filters restored messages without text', () => {
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
        kind: 'replace-runtime-conversation',
        threadId: 'thread-1',
        items: [
          createRuntimeUserMessage({
            itemId: 'user-1',
            text: null,
          }),
          createRuntimeAgentMessage({
            itemId: 'assistant-1',
            text: null,
          }),
        ],
      }),
      {
        revision: 1,
        items: [],
      },
    );
    assert.deepEqual(events, [
      {
        kind: 'conversation-replaced',
        threadId: 'thread-1',
        revision: 1,
        items: [],
      },
    ]);
  });

  test('updates the same runtime item identity instead of appending duplicates', () => {
    const service = createConversationService({
      events: {
        publish() {},
        subscribe() {
          return () => {};
        },
      },
    });

    service.apply({
      kind: 'record-runtime-thread-item',
      threadId: 'thread-1',
      item: createRuntimeAgentMessage({
        itemId: 'item-1',
        text: 'draft answer',
      }),
    });

    assert.deepEqual(
      service.apply({
        kind: 'record-runtime-thread-item',
        threadId: 'thread-1',
        item: createRuntimeAgentMessage({
          itemId: 'item-1',
          text: 'final answer',
        }),
      }),
      {
        revision: 2,
        items: [
          {
            id: 'item-1',
            kind: 'message',
            role: 'assistant',
            text: 'final answer',
          },
        ],
      },
    );
  });

  test('does not advance revision or publish when the same runtime item is unchanged', () => {
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
    const item = createRuntimeAgentMessage({
      itemId: 'item-1',
      text: 'same answer',
    });

    service.apply({
      kind: 'record-runtime-thread-item',
      threadId: 'thread-1',
      item,
    });

    assert.deepEqual(
      service.apply({
        kind: 'record-runtime-thread-item',
        threadId: 'thread-1',
        item,
      }),
      {
        revision: 1,
        items: [
          {
            id: 'item-1',
            kind: 'message',
            role: 'assistant',
            text: 'same answer',
          },
        ],
      },
    );
    assert.deepEqual(events, [
      {
        kind: 'conversation-item-upserted',
        threadId: 'thread-1',
        revision: 1,
        item: {
          id: 'item-1',
          kind: 'message',
          role: 'assistant',
          text: 'same answer',
        },
      },
    ]);
  });

  test('ignores runtime work trace items until their slices define the projection', () => {
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
        kind: 'record-runtime-thread-item',
        threadId: 'thread-1',
        item: createRuntimePlanItem({
          itemId: 'plan-1',
          text: 'Plan',
        }),
      }),
      {
        revision: 0,
        items: [],
      },
    );
    assert.deepEqual(events, []);
  });

  test('keeps timelines isolated by thread id', () => {
    const service = createConversationService({
      events: {
        publish() {},
        subscribe() {
          return () => {};
        },
      },
    });

    service.apply({
      kind: 'record-runtime-thread-item',
      threadId: 'thread-1',
      item: createRuntimeAgentMessage({
        itemId: 'shared-item',
        text: 'thread one answer',
      }),
    });
    service.apply({
      kind: 'record-runtime-thread-item',
      threadId: 'thread-2',
      item: createRuntimeAgentMessage({
        itemId: 'shared-item',
        text: 'thread two answer',
      }),
    });

    assert.deepEqual(service.snapshot({ threadId: 'thread-1' }), {
      revision: 1,
      items: [
        {
          id: 'shared-item',
          kind: 'message',
          role: 'assistant',
          text: 'thread one answer',
        },
      ],
    });
    assert.deepEqual(service.snapshot({ threadId: 'thread-2' }), {
      revision: 1,
      items: [
        {
          id: 'shared-item',
          kind: 'message',
          role: 'assistant',
          text: 'thread two answer',
        },
      ],
    });
  });
});

interface CreateRuntimeMessageInput {
  readonly itemId: string;
  readonly text: string | null;
}

function createRuntimeUserMessage(input: CreateRuntimeMessageInput): RuntimeThreadItem {
  return {
    itemId: input.itemId,
    itemKind: 'userMessage',
    status: null,
    text: input.text,
    content: [],
  };
}

function createRuntimeAgentMessage(input: CreateRuntimeMessageInput): RuntimeThreadItem {
  return {
    itemId: input.itemId,
    itemKind: 'agentMessage',
    status: null,
    text: input.text,
    phase: null,
    memoryCitation: null,
  };
}

function createRuntimePlanItem(input: CreateRuntimeMessageInput): RuntimeThreadItem {
  return {
    itemId: input.itemId,
    itemKind: 'plan',
    status: null,
    text: input.text,
  };
}
