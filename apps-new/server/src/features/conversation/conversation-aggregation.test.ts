import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createConversationService } from './conversation-service.js';
import type { ConversationDomainEvent, ConversationSchedulerPort, ScheduleConversationFlushInput } from './index.js';

describe('aggregated conversation event delivery', () => {
  test('publishes one complete item snapshot after the 500ms aggregation window', () => {
    const events: ConversationDomainEvent[] = [];
    const scheduler = createManualConversationScheduler();
    const service = createConversationService({
      events: {
        publish(event) {
          events.push(event as ConversationDomainEvent);
        },
        subscribe() {
          return () => {};
        },
      },
      scheduler,
    });

    service.apply({
      kind: 'record-runtime-item-delta',
      threadId: 'thread-1',
      itemId: 'assistant-1',
      deltaKind: 'agent-message',
      text: '你',
    });
    service.apply({
      kind: 'record-runtime-item-delta',
      threadId: 'thread-1',
      itemId: 'assistant-1',
      deltaKind: 'agent-message',
      text: '好',
    });
    service.apply({
      kind: 'record-runtime-item-delta',
      threadId: 'thread-1',
      itemId: 'assistant-1',
      deltaKind: 'agent-message',
      text: '，世界',
    });

    assert.deepEqual(events, []);

    scheduler.advanceBy(499);
    assert.deepEqual(events, []);

    scheduler.advanceBy(1);
    assert.deepEqual(events, [
      {
        kind: 'conversation-item-upserted',
        threadId: 'thread-1',
        revision: 1,
        item: {
          id: 'assistant-1',
          kind: 'message',
          role: 'assistant',
          text: '你好，世界',
        },
      },
    ]);
  });

  test('completed runtime item flushes the final item immediately and does not duplicate the scheduled flush', () => {
    const events: ConversationDomainEvent[] = [];
    const scheduler = createManualConversationScheduler();
    const service = createConversationService({
      events: {
        publish(event) {
          events.push(event as ConversationDomainEvent);
        },
        subscribe() {
          return () => {};
        },
      },
      scheduler,
    });

    service.apply({
      kind: 'record-runtime-item-delta',
      threadId: 'thread-1',
      itemId: 'assistant-1',
      deltaKind: 'agent-message',
      text: 'partial',
    });
    scheduler.advanceBy(100);
    service.apply({
      kind: 'record-runtime-thread-item',
      threadId: 'thread-1',
      item: {
        itemId: 'assistant-1',
        itemKind: 'agentMessage',
        status: 'completed',
        text: 'final answer',
        phase: null,
        memoryCitation: null,
      },
    });

    assert.deepEqual(events, [
      {
        kind: 'conversation-item-upserted',
        threadId: 'thread-1',
        revision: 1,
        item: {
          id: 'assistant-1',
          kind: 'message',
          role: 'assistant',
          text: 'final answer',
        },
      },
    ]);

    scheduler.advanceBy(400);
    assert.deepEqual(events, [
      {
        kind: 'conversation-item-upserted',
        threadId: 'thread-1',
        revision: 1,
        item: {
          id: 'assistant-1',
          kind: 'message',
          role: 'assistant',
          text: 'final answer',
        },
      },
    ]);
  });

  test('keeps previous flushed text when later delta arrives in another aggregation window', () => {
    const events: ConversationDomainEvent[] = [];
    const scheduler = createManualConversationScheduler();
    const service = createConversationService({
      events: {
        publish(event) {
          events.push(event as ConversationDomainEvent);
        },
        subscribe() {
          return () => {};
        },
      },
      scheduler,
    });

    service.apply({
      kind: 'record-runtime-item-delta',
      threadId: 'thread-1',
      itemId: 'assistant-1',
      deltaKind: 'agent-message',
      text: '你',
    });
    scheduler.advanceBy(500);
    service.apply({
      kind: 'record-runtime-item-delta',
      threadId: 'thread-1',
      itemId: 'assistant-1',
      deltaKind: 'agent-message',
      text: '好',
    });
    scheduler.advanceBy(500);

    assert.deepEqual(events, [
      {
        kind: 'conversation-item-upserted',
        threadId: 'thread-1',
        revision: 1,
        item: {
          id: 'assistant-1',
          kind: 'message',
          role: 'assistant',
          text: '你',
        },
      },
      {
        kind: 'conversation-item-upserted',
        threadId: 'thread-1',
        revision: 2,
        item: {
          id: 'assistant-1',
          kind: 'message',
          role: 'assistant',
          text: '你好',
        },
      },
    ]);
    assert.deepEqual(service.snapshot({ threadId: 'thread-1' }), {
      revision: 2,
      items: [
        {
          id: 'assistant-1',
          kind: 'message',
          role: 'assistant',
          text: '你好',
        },
      ],
    });
  });

  test('appends delta to existing started item text', () => {
    const events: ConversationDomainEvent[] = [];
    const scheduler = createManualConversationScheduler();
    const service = createConversationService({
      events: {
        publish(event) {
          events.push(event as ConversationDomainEvent);
        },
        subscribe() {
          return () => {};
        },
      },
      scheduler,
    });

    service.apply({
      kind: 'record-runtime-thread-item',
      threadId: 'thread-1',
      item: {
        itemId: 'assistant-1',
        itemKind: 'agentMessage',
        status: 'in-progress',
        text: '你好，',
        phase: null,
        memoryCitation: null,
      },
    });
    service.apply({
      kind: 'record-runtime-item-delta',
      threadId: 'thread-1',
      itemId: 'assistant-1',
      deltaKind: 'agent-message',
      text: '世界',
    });
    scheduler.advanceBy(500);

    assert.deepEqual(events, [
      {
        kind: 'conversation-item-upserted',
        threadId: 'thread-1',
        revision: 1,
        item: {
          id: 'assistant-1',
          kind: 'message',
          role: 'assistant',
          text: '你好，',
        },
      },
      {
        kind: 'conversation-item-upserted',
        threadId: 'thread-1',
        revision: 2,
        item: {
          id: 'assistant-1',
          kind: 'message',
          role: 'assistant',
          text: '你好，世界',
        },
      },
    ]);
  });

  test('completed runtime item replaces aggregated text with authoritative final text', () => {
    const events: ConversationDomainEvent[] = [];
    const scheduler = createManualConversationScheduler();
    const service = createConversationService({
      events: {
        publish(event) {
          events.push(event as ConversationDomainEvent);
        },
        subscribe() {
          return () => {};
        },
      },
      scheduler,
    });

    service.apply({
      kind: 'record-runtime-thread-item',
      threadId: 'thread-1',
      item: {
        itemId: 'assistant-1',
        itemKind: 'agentMessage',
        status: 'in-progress',
        text: 'draft ',
        phase: null,
        memoryCitation: null,
      },
    });
    service.apply({
      kind: 'record-runtime-item-delta',
      threadId: 'thread-1',
      itemId: 'assistant-1',
      deltaKind: 'agent-message',
      text: 'partial',
    });
    service.apply({
      kind: 'record-runtime-thread-item',
      threadId: 'thread-1',
      item: {
        itemId: 'assistant-1',
        itemKind: 'agentMessage',
        status: 'completed',
        text: 'final answer',
        phase: null,
        memoryCitation: null,
      },
    });
    scheduler.advanceBy(500);

    assert.deepEqual(events, [
      {
        kind: 'conversation-item-upserted',
        threadId: 'thread-1',
        revision: 1,
        item: {
          id: 'assistant-1',
          kind: 'message',
          role: 'assistant',
          text: 'draft ',
        },
      },
      {
        kind: 'conversation-item-upserted',
        threadId: 'thread-1',
        revision: 2,
        item: {
          id: 'assistant-1',
          kind: 'message',
          role: 'assistant',
          text: 'final answer',
        },
      },
    ]);
  });

  test('keeps aggregated delta buffers isolated by thread id', () => {
    const events: ConversationDomainEvent[] = [];
    const scheduler = createManualConversationScheduler();
    const service = createConversationService({
      events: {
        publish(event) {
          events.push(event as ConversationDomainEvent);
        },
        subscribe() {
          return () => {};
        },
      },
      scheduler,
    });

    service.apply({
      kind: 'record-runtime-item-delta',
      threadId: 'thread-1',
      itemId: 'shared-item',
      deltaKind: 'agent-message',
      text: 'thread one',
    });
    service.apply({
      kind: 'record-runtime-item-delta',
      threadId: 'thread-2',
      itemId: 'shared-item',
      deltaKind: 'agent-message',
      text: 'thread two',
    });

    scheduler.advanceBy(500);

    assert.deepEqual(events, [
      {
        kind: 'conversation-item-upserted',
        threadId: 'thread-1',
        revision: 1,
        item: {
          id: 'shared-item',
          kind: 'message',
          role: 'assistant',
          text: 'thread one',
        },
      },
      {
        kind: 'conversation-item-upserted',
        threadId: 'thread-2',
        revision: 1,
        item: {
          id: 'shared-item',
          kind: 'message',
          role: 'assistant',
          text: 'thread two',
        },
      },
    ]);
    assert.deepEqual(service.snapshot({ threadId: 'thread-1' }), {
      revision: 1,
      items: [
        {
          id: 'shared-item',
          kind: 'message',
          role: 'assistant',
          text: 'thread one',
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
          text: 'thread two',
        },
      ],
    });
  });

  test('completed item flushes only the matching thread pending item', () => {
    const events: ConversationDomainEvent[] = [];
    const scheduler = createManualConversationScheduler();
    const service = createConversationService({
      events: {
        publish(event) {
          events.push(event as ConversationDomainEvent);
        },
        subscribe() {
          return () => {};
        },
      },
      scheduler,
    });

    service.apply({
      kind: 'record-runtime-item-delta',
      threadId: 'thread-1',
      itemId: 'shared-item',
      deltaKind: 'agent-message',
      text: 'thread one pending',
    });
    service.apply({
      kind: 'record-runtime-thread-item',
      threadId: 'thread-2',
      item: {
        itemId: 'shared-item',
        itemKind: 'agentMessage',
        status: 'completed',
        text: 'thread two final',
        phase: null,
        memoryCitation: null,
      },
    });

    assert.deepEqual(events, [
      {
        kind: 'conversation-item-upserted',
        threadId: 'thread-2',
        revision: 1,
        item: {
          id: 'shared-item',
          kind: 'message',
          role: 'assistant',
          text: 'thread two final',
        },
      },
    ]);

    scheduler.advanceBy(500);

    assert.deepEqual(events, [
      {
        kind: 'conversation-item-upserted',
        threadId: 'thread-2',
        revision: 1,
        item: {
          id: 'shared-item',
          kind: 'message',
          role: 'assistant',
          text: 'thread two final',
        },
      },
      {
        kind: 'conversation-item-upserted',
        threadId: 'thread-1',
        revision: 1,
        item: {
          id: 'shared-item',
          kind: 'message',
          role: 'assistant',
          text: 'thread one pending',
        },
      },
    ]);
  });

  test('replacement discards pending delta for the restored thread', () => {
    const events: ConversationDomainEvent[] = [];
    const scheduler = createManualConversationScheduler();
    const service = createConversationService({
      events: {
        publish(event) {
          events.push(event as ConversationDomainEvent);
        },
        subscribe() {
          return () => {};
        },
      },
      scheduler,
    });

    service.apply({
      kind: 'record-runtime-item-delta',
      threadId: 'thread-1',
      itemId: 'assistant-pending',
      deltaKind: 'agent-message',
      text: 'stale pending text',
    });
    service.apply({
      kind: 'replace-runtime-conversation',
      threadId: 'thread-1',
      items: [
        {
          itemId: 'user-restored',
          itemKind: 'userMessage',
          status: null,
          text: 'restored hello',
          content: [],
        },
      ],
    });

    scheduler.advanceBy(500);

    assert.deepEqual(events, [
      {
        kind: 'conversation-replaced',
        threadId: 'thread-1',
        revision: 1,
        items: [
          {
            id: 'user-restored',
            kind: 'message',
            role: 'user',
            text: 'restored hello',
          },
        ],
      },
    ]);
    assert.deepEqual(service.snapshot({ threadId: 'thread-1' }), {
      revision: 1,
      items: [
        {
          id: 'user-restored',
          kind: 'message',
          role: 'user',
          text: 'restored hello',
        },
      ],
    });
  });
});

interface ManualScheduledTask {
  readonly dueAt: number;
  readonly input: ScheduleConversationFlushInput;
  cancelled: boolean;
}

interface ManualConversationScheduler extends ConversationSchedulerPort {
  advanceBy(ms: number): void;
}

function createManualConversationScheduler(): ManualConversationScheduler {
  let nowMs = 0;
  const tasks: ManualScheduledTask[] = [];

  return {
    schedule(input: ScheduleConversationFlushInput) {
      const task: ManualScheduledTask = {
        dueAt: nowMs + input.delayMs,
        input,
        cancelled: false,
      };
      tasks.push(task);

      return {
        cancel() {
          task.cancelled = true;
        },
      };
    },

    advanceBy(ms: number) {
      nowMs += ms;
      for (const task of tasks) {
        if (!task.cancelled && task.dueAt <= nowMs) {
          task.cancelled = true;
          task.input.run();
        }
      }
    },
  };
}
