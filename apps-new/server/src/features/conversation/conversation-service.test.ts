import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createConversationService } from './conversation-service.js';
import { applyConversationDomainEvent, ConversationTimelinePositionError, createInitialConversationState } from './conversation-state.js';
import type { ConversationDomainEvent } from './index.js';
import type { RuntimeThreadItem, RuntimeTurn } from '../../ports/index.js';

type JsonObject = NonNullable<RuntimeThreadItem['raw']>;

interface ConversationServiceFixture {
  readonly events: readonly ConversationDomainEvent[];
  readonly service: ReturnType<typeof createConversationService>;
}

function createConversationServiceFixture(): ConversationServiceFixture {
  const events: ConversationDomainEvent[] = [];

  return {
    events,
    service: createConversationService({
      events: {
        publish(event) {
          events.push(event as ConversationDomainEvent);
        },
        subscribe() {
          return () => {};
        },
      },
    }),
  };
}

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
      status: 'ready',
      revision: 0,
      items: [],
    });
  });

  test('replace-conversation publishes an authoritative replacement event', () => {
    const fixture = createConversationServiceFixture();
    const service = fixture.service;
    const events = fixture.events;

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
        status: 'ready',
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

    assert.deepEqual(stripConversationPositions(events), [
      {
        kind: 'conversation-replaced',
        threadId: 'thread-1',
        revision: 1,
        conversation: {
          status: 'ready',
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
      },
    ]);
  });

  test('fail-conversation publishes a failed resource replacement event', () => {
    const fixture = createConversationServiceFixture();
    const service = fixture.service;

    assert.deepEqual(service.apply({
      kind: 'fail-conversation',
      threadId: 'thread-1',
      error: {
        message: 'restore failed',
      },
    }), {
      status: 'failed',
      revision: 1,
      error: {
        message: 'restore failed',
      },
    });
    assert.deepEqual(stripConversationPositions(fixture.events), [
      {
        kind: 'conversation-replaced',
        threadId: 'thread-1',
        revision: 1,
        conversation: {
          status: 'failed',
          revision: 1,
          error: {
            message: 'restore failed',
          },
        },
      },
    ]);
  });

  test('does not append timeline items while the conversation resource is failed', () => {
    const fixture = createConversationServiceFixture();
    const service = fixture.service;

    service.apply({
      kind: 'fail-conversation',
      threadId: 'thread-1',
      error: {
        message: 'restore failed',
      },
    });

    assert.deepEqual(service.apply({
      kind: 'record-runtime-thread-item',
      threadId: 'thread-1',
      item: createRuntimeAgentMessage({
        itemId: 'assistant-1',
        text: 'should wait for replacement',
      }),
    }), {
      status: 'failed',
      revision: 1,
      error: {
        message: 'restore failed',
      },
    });
    assert.equal(fixture.events.length, 1);
  });

  test('replace-runtime-conversation restores a failed conversation resource to ready', () => {
    const fixture = createConversationServiceFixture();
    const service = fixture.service;

    service.apply({
      kind: 'fail-conversation',
      threadId: 'thread-1',
      error: {
        message: 'restore failed',
      },
    });

    assert.deepEqual(service.apply({
      kind: 'replace-runtime-conversation',
      threadId: 'thread-1',
      items: [
        createRuntimeAgentMessage({
          itemId: 'assistant-1',
          text: 'restored answer',
        }),
      ],
      turns: null,
    }), {
      status: 'ready',
      revision: 2,
      items: [
        {
          id: 'assistant-1',
          kind: 'message',
          role: 'assistant',
          text: 'restored answer',
        },
      ],
    });
    assert.deepEqual(fixture.events[1], {
      kind: 'conversation-replaced',
      threadId: 'thread-1',
      revision: 2,
      conversation: {
        status: 'ready',
        revision: 2,
        items: [
          {
            id: 'assistant-1',
            kind: 'message',
            role: 'assistant',
            text: 'restored answer',
          },
        ],
      },
    });
  });

  test('projects runtime user and assistant messages inside the conversation feature', () => {
    const fixture = createConversationServiceFixture();
    const service = fixture.service;
    const events = fixture.events;

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
      status: 'ready',
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
    assert.deepEqual(stripConversationPositions(events), [
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
    const fixture = createConversationServiceFixture();
    const service = fixture.service;
    const events = fixture.events;

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
      status: 'ready',
      revision: 0,
      items: [],
    });
    assert.deepEqual(stripConversationPositions(events), []);
  });

  test('replace-runtime-conversation keeps confirmed messages and work traces in authoritative order', () => {
    const fixture = createConversationServiceFixture();
    const service = fixture.service;
    const events = fixture.events;

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
            raw: {
              id: 'plan-1',
              type: 'plan',
              status: 'completed',
              explanation: 'Plan',
            },
          }),
          createRuntimeCommandExecutionItem({
            itemId: 'command-1',
            raw: {
              type: 'commandExecution',
              id: 'command-1',
              status: 'completed',
              command: 'npm test',
              aggregatedOutput: 'ok',
            },
          }),
          createRuntimeAgentMessage({
            itemId: 'assistant-1',
            text: 'restored answer',
          }),
        ],
        turns: null,
      }),
      {
        status: 'ready',
        revision: 1,
        items: [
          {
            id: 'user-1',
            kind: 'message',
            role: 'user',
            text: 'restored hello',
          },
          {
            id: 'plan-1',
            kind: 'work-trace',
            codexType: 'plan',
            fields: [
              { name: 'id', value: 'plan-1' },
              { name: 'type', value: 'plan' },
              { name: 'status', value: 'completed' },
              { name: 'explanation', value: 'Plan' },
            ],
          },
          {
            id: 'command-1',
            kind: 'work-trace',
            codexType: 'commandExecution',
            fields: [
              { name: 'type', value: 'commandExecution' },
              { name: 'id', value: 'command-1' },
              { name: 'status', value: 'completed' },
              { name: 'command', value: 'npm test' },
              { name: 'aggregatedOutput', value: 'ok' },
            ],
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
    assert.deepEqual(stripConversationPositions(events), [
      {
        kind: 'conversation-replaced',
        threadId: 'thread-1',
        revision: 1,
        conversation: {
          status: 'ready',
          revision: 1,
          items: [
            {
              id: 'user-1',
              kind: 'message',
              role: 'user',
              text: 'restored hello',
            },
            {
              id: 'plan-1',
              kind: 'work-trace',
              codexType: 'plan',
              fields: [
                { name: 'id', value: 'plan-1' },
                { name: 'type', value: 'plan' },
                { name: 'status', value: 'completed' },
                { name: 'explanation', value: 'Plan' },
              ],
            },
            {
              id: 'command-1',
              kind: 'work-trace',
              codexType: 'commandExecution',
              fields: [
                { name: 'type', value: 'commandExecution' },
                { name: 'id', value: 'command-1' },
                { name: 'status', value: 'completed' },
                { name: 'command', value: 'npm test' },
                { name: 'aggregatedOutput', value: 'ok' },
              ],
            },
            {
              id: 'assistant-1',
              kind: 'message',
              role: 'assistant',
              text: 'restored answer',
            },
          ],
        },
      },
    ]);
  });

  test('replace-runtime-conversation filters restored messages without text', () => {
    const fixture = createConversationServiceFixture();
    const service = fixture.service;
    const events = fixture.events;

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
        turns: null,
      }),
      {
        status: 'ready',
        revision: 1,
        items: [],
      },
    );
    assert.deepEqual(stripConversationPositions(events), [
      {
        kind: 'conversation-replaced',
        threadId: 'thread-1',
        revision: 1,
        conversation: {
          status: 'ready',
          revision: 1,
          items: [],
        },
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
        status: 'ready',
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
    const fixture = createConversationServiceFixture();
    const service = fixture.service;
    const events = fixture.events;
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
        status: 'ready',
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
    assert.deepEqual(stripConversationPositions(events), [
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

  test('projects known runtime work trace items with raw payload fields in original order', () => {
    const fixture = createConversationServiceFixture();
    const service = fixture.service;
    const events = fixture.events;

    assert.deepEqual(
      service.apply({
        kind: 'record-runtime-thread-item',
        threadId: 'thread-1',
        item: createRuntimePlanItem({
          itemId: 'plan-1',
          text: 'Plan',
          raw: {
            type: 'plan',
            id: 'plan-1',
            status: 'completed',
            explanation: 'Plan',
            plan: [{ step: 'Read docs', status: 'completed' }],
          },
        }),
      }),
      {
        status: 'ready',
        revision: 1,
        items: [
          {
            id: 'plan-1',
            kind: 'work-trace',
            codexType: 'plan',
            fields: [
              { name: 'type', value: 'plan' },
              { name: 'id', value: 'plan-1' },
              { name: 'status', value: 'completed' },
              { name: 'explanation', value: 'Plan' },
              { name: 'plan', value: [{ step: 'Read docs', status: 'completed' }] },
            ],
          },
        ],
      },
    );
    assert.deepEqual(stripConversationPositions(events), [
      {
        kind: 'conversation-item-upserted',
        threadId: 'thread-1',
        revision: 1,
        item: {
          id: 'plan-1',
          kind: 'work-trace',
          codexType: 'plan',
          fields: [
            { name: 'type', value: 'plan' },
            { name: 'id', value: 'plan-1' },
            { name: 'status', value: 'completed' },
            { name: 'explanation', value: 'Plan' },
            { name: 'plan', value: [{ step: 'Read docs', status: 'completed' }] },
          ],
        },
      },
    ]);
  });

  test('keeps work trace and unknown items observable with empty fields when raw payload is unavailable', () => {
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
      item: createRuntimePlanItem({
        itemId: 'plan-1',
        text: 'Plan',
      }),
    });
    service.apply({
      kind: 'record-runtime-thread-item',
      threadId: 'thread-1',
      item: createRuntimeUnknownItem({
        itemId: 'future-1',
        unknownItemKind: 'futureCodexItem',
      }),
    });

    assert.deepEqual(service.snapshot({ threadId: 'thread-1' }), {
      status: 'ready',
      revision: 2,
      items: [
        {
          id: 'plan-1',
          kind: 'work-trace',
          codexType: 'plan',
          fields: [],
        },
        {
          id: 'future-1',
          kind: 'unknown',
          codexType: 'futureCodexItem',
          fields: [],
        },
      ],
    });
  });

  test('projects every known runtime work trace item kind as a work trace', () => {
    const service = createConversationService({
      events: {
        publish() {},
        subscribe() {
          return () => {};
        },
      },
    });
    const knownKinds = [
      'hookPrompt',
      'plan',
      'reasoning',
      'commandExecution',
      'fileChange',
      'mcpToolCall',
      'dynamicToolCall',
      'collabAgentToolCall',
      'webSearch',
      'imageView',
      'imageGeneration',
      'enteredReviewMode',
      'exitedReviewMode',
      'contextCompaction',
    ] as const;

    for (const kind of knownKinds) {
      service.apply({
        kind: 'record-runtime-thread-item',
        threadId: 'thread-1',
        item: createKnownRuntimeWorkTraceItem({
          itemId: `${kind}-1`,
          itemKind: kind,
          raw: {
            id: `${kind}-1`,
            type: kind,
            status: 'completed',
          },
        }),
      });
    }

    const snapshot = service.snapshot({ threadId: 'thread-1' });

    assert.equal(snapshot.status, 'ready');
    assert.equal(snapshot.revision, knownKinds.length);
    assert.deepEqual(snapshot.status === 'ready' ? snapshot.items.map(item => ({
      id: item.id,
      kind: item.kind,
      codexType: item.kind === 'work-trace' ? item.codexType : null,
    })) : [], knownKinds.map(kind => ({
      id: `${kind}-1`,
      kind: 'work-trace',
      codexType: kind,
    })));
  });

  test('updates a work trace item with the same runtime item identity', () => {
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
      item: createRuntimeCommandExecutionItem({
        itemId: 'command-1',
        raw: {
          id: 'command-1',
          type: 'commandExecution',
          status: 'in-progress',
          command: 'npm test',
        },
      }),
    });

    assert.deepEqual(service.apply({
      kind: 'record-runtime-thread-item',
      threadId: 'thread-1',
      item: createRuntimeCommandExecutionItem({
        itemId: 'command-1',
        raw: {
          id: 'command-1',
          type: 'commandExecution',
          status: 'completed',
          command: 'npm test',
          aggregatedOutput: 'ok',
        },
      }),
    }), {
      status: 'ready',
      revision: 2,
      items: [
        {
          id: 'command-1',
          kind: 'work-trace',
          codexType: 'commandExecution',
          fields: [
            { name: 'id', value: 'command-1' },
            { name: 'type', value: 'commandExecution' },
            { name: 'status', value: 'completed' },
            { name: 'command', value: 'npm test' },
            { name: 'aggregatedOutput', value: 'ok' },
          ],
        },
      ],
    });
  });

  test('keeps unknown runtime items observable without treating them as work traces', () => {
    const fixture = createConversationServiceFixture();
    const service = fixture.service;
    const events = fixture.events;

    service.apply({
      kind: 'record-runtime-thread-item',
      threadId: 'thread-1',
      item: createRuntimeUnknownItem({
        itemId: 'future-1',
        unknownItemKind: 'futureCodexItem',
        raw: {
          id: 'future-1',
          type: 'futureCodexItem',
          payload: { nested: true },
        },
      }),
    });

    assert.deepEqual(service.snapshot({ threadId: 'thread-1' }), {
      status: 'ready',
      revision: 1,
      items: [
        {
          id: 'future-1',
          kind: 'unknown',
          codexType: 'futureCodexItem',
          fields: [
            { name: 'id', value: 'future-1' },
            { name: 'type', value: 'futureCodexItem' },
            { name: 'payload', value: { nested: true } },
          ],
        },
      ],
    });
    assert.deepEqual(stripConversationPositions(events), [
      {
        kind: 'conversation-item-upserted',
        threadId: 'thread-1',
        revision: 1,
        item: {
          id: 'future-1',
          kind: 'unknown',
          codexType: 'futureCodexItem',
          fields: [
            { name: 'id', value: 'future-1' },
            { name: 'type', value: 'futureCodexItem' },
            { name: 'payload', value: { nested: true } },
          ],
        },
      },
    ]);
  });

  test('records a turn-scoped runtime error as a conversation error timeline item', () => {
    const fixture = createConversationServiceFixture();
    const service = fixture.service;

    assert.deepEqual(
      service.apply({
        kind: 'record-runtime-error',
        threadId: 'thread-1',
        turnId: 'turn-1',
        error: {
          message: 'runtime failed',
          code: 'RUNTIME_FAILED',
        },
      }),
      {
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
    );

    assert.deepEqual(stripConversationPositions(fixture.events), [
      {
        kind: 'conversation-item-upserted',
        threadId: 'thread-1',
        revision: 1,
        item: {
          id: 'error:turn-1',
          kind: 'error',
          message: 'runtime failed',
        },
      },
    ]);
  });

  test('updates the same conversation error item for repeated errors on the same turn', () => {
    const fixture = createConversationServiceFixture();
    const service = fixture.service;

    service.apply({
      kind: 'record-runtime-error',
      threadId: 'thread-1',
      turnId: 'turn-1',
      error: {
        message: 'first error',
        code: null,
      },
    });

    assert.deepEqual(
      service.apply({
        kind: 'record-runtime-error',
        threadId: 'thread-1',
        turnId: 'turn-1',
        error: {
          message: 'final error',
          code: null,
        },
      }),
      {
        status: 'ready',
        revision: 2,
        items: [
          {
            id: 'error:turn-1',
            kind: 'error',
            message: 'final error',
          },
        ],
      },
    );
  });

  test('does not advance revision or publish when the same conversation error is unchanged', () => {
    const fixture = createConversationServiceFixture();
    const service = fixture.service;

    service.apply({
      kind: 'record-runtime-error',
      threadId: 'thread-1',
      turnId: 'turn-1',
      error: {
        message: 'runtime failed',
        code: null,
      },
    });

    assert.deepEqual(
      service.apply({
        kind: 'record-runtime-error',
        threadId: 'thread-1',
        turnId: 'turn-1',
        error: {
          message: 'runtime failed',
          code: null,
        },
      }),
      {
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
    );
    assert.deepEqual(stripConversationPositions(fixture.events), [
      {
        kind: 'conversation-item-upserted',
        threadId: 'thread-1',
        revision: 1,
        item: {
          id: 'error:turn-1',
          kind: 'error',
          message: 'runtime failed',
        },
      },
    ]);
  });

  test('records errors from different turns as separate conversation error items', () => {
    const fixture = createConversationServiceFixture();
    const service = fixture.service;

    service.apply({
      kind: 'record-runtime-error',
      threadId: 'thread-1',
      turnId: 'turn-1',
      error: {
        message: 'first turn failed',
        code: null,
      },
    });

    assert.deepEqual(
      service.apply({
        kind: 'record-runtime-error',
        threadId: 'thread-1',
        turnId: 'turn-2',
        error: {
          message: 'second turn failed',
          code: null,
        },
      }),
      {
        status: 'ready',
        revision: 2,
        items: [
          {
            id: 'error:turn-1',
            kind: 'error',
            message: 'first turn failed',
          },
          {
            id: 'error:turn-2',
            kind: 'error',
            message: 'second turn failed',
          },
        ],
      },
    );
  });

  test('restores failed turn errors into the timeline after the restored turn items', () => {
    const fixture = createConversationServiceFixture();
    const service = fixture.service;
    const turn: RuntimeTurn = {
      id: 'turn-1',
      status: 'failed',
      error: {
        message: 'restored turn failed',
        code: 'RUNTIME_FAILED',
      },
      startedAt: null,
      completedAt: null,
      durationMs: null,
      items: [
        createRuntimeUserMessage({
          itemId: 'user-1',
          text: 'hello',
        }),
        createRuntimeAgentMessage({
          itemId: 'assistant-1',
          text: 'partial answer',
        }),
      ],
    };

    assert.deepEqual(
      service.apply({
        kind: 'replace-runtime-conversation',
        threadId: 'thread-1',
        items: [],
        turns: [turn],
      }),
      {
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
            text: 'partial answer',
          },
          {
            id: 'error:turn-1',
            kind: 'error',
            message: 'restored turn failed',
          },
        ],
      },
    );
  });

  test('keeps tool call payload errors as work trace fields instead of conversation error cards', () => {
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
      item: createKnownRuntimeWorkTraceItem({
        itemId: 'mcp-1',
        itemKind: 'mcpToolCall',
        raw: {
          id: 'mcp-1',
          type: 'mcpToolCall',
          status: 'failed',
          error: {
            message: 'tool failed',
          },
        },
      }),
    });

    assert.deepEqual(service.snapshot({ threadId: 'thread-1' }), {
      status: 'ready',
      revision: 1,
      items: [
        {
          id: 'mcp-1',
          kind: 'work-trace',
          codexType: 'mcpToolCall',
          fields: [
            { name: 'id', value: 'mcp-1' },
            { name: 'type', value: 'mcpToolCall' },
            { name: 'status', value: 'failed' },
            { name: 'error', value: { message: 'tool failed' } },
          ],
        },
      ],
    });
  });

  test('uses a stable unknown codex type when the runtime fallback item has an empty unknown kind', () => {
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
      item: createRuntimeUnknownItem({
        itemId: 'future-1',
        unknownItemKind: '',
        raw: {
          id: 'future-1',
          type: '',
          payload: { nested: true },
        },
      }),
    });

    assert.deepEqual(service.snapshot({ threadId: 'thread-1' }), {
      status: 'ready',
      revision: 1,
      items: [
        {
          id: 'future-1',
          kind: 'unknown',
          codexType: 'unknown',
          fields: [
            { name: 'id', value: 'future-1' },
            { name: 'type', value: '' },
            { name: 'payload', value: { nested: true } },
          ],
        },
      ],
    });
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
      status: 'ready',
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
      status: 'ready',
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

  test('turn plan updates are projected as stable plan work trace items', () => {
    const { events, service } = createConversationServiceFixture();

    const snapshot = service.apply({
      kind: 'record-runtime-turn-plan',
      threadId: 'thread-1',
      turnId: 'turn-1',
      explanation: 'next steps',
      plan: [{ step: 'Read files', status: 'pending' }],
    });

    assert.deepEqual(snapshot, {
      status: 'ready',
      revision: 1,
      items: [
        {
          id: 'plan:turn-1',
          kind: 'work-trace',
          codexType: 'plan',
          fields: [
            { name: 'turnId', value: 'turn-1' },
            { name: 'explanation', value: 'next steps' },
            { name: 'plan', value: [{ step: 'Read files', status: 'pending' }] },
          ],
        },
      ],
    });
    assert.deepEqual(stripConversationPositions(events), [
      {
        kind: 'conversation-item-upserted',
        threadId: 'thread-1',
        revision: 1,
        item: snapshot.items[0],
      },
    ]);
  });

  test('turn diff updates are projected as stable file change work trace items', () => {
    const { events, service } = createConversationServiceFixture();

    const snapshot = service.apply({
      kind: 'record-runtime-turn-diff',
      threadId: 'thread-1',
      turnId: 'turn-1',
      diff: 'diff --git a/app.ts b/app.ts',
    });

    assert.deepEqual(snapshot, {
      status: 'ready',
      revision: 1,
      items: [
        {
          id: 'diff:turn-1',
          kind: 'work-trace',
          codexType: 'fileChange',
          fields: [
            { name: 'turnId', value: 'turn-1' },
            { name: 'diff', value: 'diff --git a/app.ts b/app.ts' },
          ],
        },
      ],
    });
    assert.deepEqual(stripConversationPositions(events), [
      {
        kind: 'conversation-item-upserted',
        threadId: 'thread-1',
        revision: 1,
        item: snapshot.items[0],
      },
    ]);
  });

  test('server timeline insert with a missing target fails explicitly', () => {
    assert.throws(() => {
      applyConversationDomainEvent({
        state: createInitialConversationState(),
        event: {
          kind: 'conversation-item-upserted',
          threadId: 'thread-1',
          revision: 1,
          item: {
            id: 'assistant-1',
            kind: 'message',
            role: 'assistant',
            text: 'hello',
          },
          position: {
            kind: 'before-item',
            itemId: 'missing',
          },
        },
      });
    }, ConversationTimelinePositionError);
  });
});

interface CreateRuntimeMessageInput {
  readonly itemId: string;
  readonly text: string | null;
}

interface CreateRuntimeWorkTraceInput {
  readonly itemId: string;
  readonly raw: JsonObject;
  readonly text?: string | null;
}

interface CreateRuntimeUnknownInput {
  readonly itemId: string;
  readonly unknownItemKind: string;
  readonly raw?: JsonObject;
}

interface CreateKnownRuntimeWorkTraceInput {
  readonly itemId: string;
  readonly itemKind:
    | 'hookPrompt'
    | 'plan'
    | 'reasoning'
    | 'commandExecution'
    | 'fileChange'
    | 'mcpToolCall'
    | 'dynamicToolCall'
    | 'collabAgentToolCall'
    | 'webSearch'
    | 'imageView'
    | 'imageGeneration'
    | 'enteredReviewMode'
    | 'exitedReviewMode'
    | 'contextCompaction';
  readonly raw: JsonObject;
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

function createRuntimePlanItem(input: CreateRuntimeMessageInput & { readonly raw?: JsonObject }): RuntimeThreadItem {
  return {
    itemId: input.itemId,
    itemKind: 'plan',
    status: null,
    text: input.text,
    raw: input.raw,
  };
}

function createRuntimeCommandExecutionItem(input: CreateRuntimeWorkTraceInput): RuntimeThreadItem {
  return {
    itemId: input.itemId,
    itemKind: 'commandExecution',
    status: null,
    text: input.text ?? null,
    command: null,
    cwd: null,
    processId: null,
    source: null,
    commandActions: [],
    aggregatedOutput: null,
    exitCode: null,
    durationMs: null,
    raw: input.raw,
  };
}

function createRuntimeUnknownItem(input: CreateRuntimeUnknownInput): RuntimeThreadItem {
  return {
    itemId: input.itemId,
    itemKind: 'unknown',
    status: null,
    text: null,
    unknownItemKind: input.unknownItemKind,
    raw: input.raw,
  };
}

function createKnownRuntimeWorkTraceItem(input: CreateKnownRuntimeWorkTraceInput): RuntimeThreadItem {
  const base = {
    itemId: input.itemId,
    status: null,
    text: null,
    raw: input.raw,
  };

  switch (input.itemKind) {
    case 'hookPrompt':
      return { ...base, itemKind: input.itemKind, fragments: [] };

    case 'plan':
      return { ...base, itemKind: input.itemKind };

    case 'reasoning':
      return { ...base, itemKind: input.itemKind, summary: [], content: [] };

    case 'commandExecution':
      return {
        ...base,
        itemKind: input.itemKind,
        command: null,
        cwd: null,
        processId: null,
        source: null,
        commandActions: [],
        aggregatedOutput: null,
        exitCode: null,
        durationMs: null,
      };

    case 'fileChange':
      return { ...base, itemKind: input.itemKind, changes: [] };

    case 'mcpToolCall':
      return {
        ...base,
        itemKind: input.itemKind,
        server: null,
        tool: null,
        arguments: null,
        result: null,
        error: null,
        durationMs: null,
      };

    case 'dynamicToolCall':
      return {
        ...base,
        itemKind: input.itemKind,
        namespace: null,
        tool: null,
        arguments: null,
        contentItems: null,
        success: null,
        durationMs: null,
      };

    case 'collabAgentToolCall':
      return {
        ...base,
        itemKind: input.itemKind,
        tool: null,
        senderThreadId: null,
        receiverThreadIds: [],
        prompt: null,
        model: null,
        reasoningEffort: null,
        agentsStates: null,
      };

    case 'webSearch':
      return { ...base, itemKind: input.itemKind, query: null, action: null };

    case 'imageView':
      return { ...base, itemKind: input.itemKind, path: null };

    case 'imageGeneration':
      return { ...base, itemKind: input.itemKind, revisedPrompt: null, result: null, savedPath: null };

    case 'enteredReviewMode':
    case 'exitedReviewMode':
      return { ...base, itemKind: input.itemKind, review: null };

    case 'contextCompaction':
      return { ...base, itemKind: input.itemKind };
  }
}


function stripConversationPositions(events: readonly ConversationDomainEvent[]): readonly ConversationDomainEvent[] {
  return events.map(event => {
    if (event.kind !== 'conversation-item-upserted') {
      return event;
    }

    return removePosition(event) as ConversationDomainEvent;
  });
}


function removePosition<T extends { readonly position?: unknown }>(event: T): Omit<T, 'position'> {
  const eventWithMutablePosition: { position?: unknown } = event;
  delete eventWithMutablePosition.position;
  return eventWithMutablePosition as Omit<T, 'position'>;
}
