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
      turnId: 'turn-1',
      itemId: 'assistant-1',
      deltaKind: 'agent-message',
      text: '你',
    });
    service.apply({
      kind: 'record-runtime-item-delta',
      threadId: 'thread-1',
      turnId: 'turn-1',
      itemId: 'assistant-1',
      deltaKind: 'agent-message',
      text: '好',
    });
    service.apply({
      kind: 'record-runtime-item-delta',
      threadId: 'thread-1',
      turnId: 'turn-1',
      itemId: 'assistant-1',
      deltaKind: 'agent-message',
      text: '，世界',
    });

    assert.deepEqual(stripConversationPositions(events), []);

    scheduler.advanceBy(499);
    assert.deepEqual(stripConversationPositions(events), []);

    scheduler.advanceBy(1);
    assert.deepEqual(stripConversationPositions(events), [
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
      turnId: 'turn-1',
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

    assert.deepEqual(stripConversationPositions(events), [
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
    assert.deepEqual(stripConversationPositions(events), [
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

  test('runtime error flushes pending assistant deltas before the error item', () => {
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
      turnId: 'turn-1',
      itemId: 'assistant-1',
      deltaKind: 'agent-message',
      text: 'partial answer',
    });
    scheduler.advanceBy(100);
    service.apply({
      kind: 'record-runtime-error',
      threadId: 'thread-1',
      turnId: 'turn-1',
      error: {
        code: null,
        message: 'stream disconnected',
      },
    });

    assert.deepEqual(stripConversationPositions(events), [
      {
        kind: 'conversation-item-upserted',
        threadId: 'thread-1',
        revision: 1,
        item: {
          id: 'assistant-1',
          kind: 'message',
          role: 'assistant',
          text: 'partial answer',
        },
      },
      {
        kind: 'conversation-item-upserted',
        threadId: 'thread-1',
        revision: 2,
        item: {
          id: 'error:turn-1',
          kind: 'error',
          message: 'stream disconnected',
        },
      },
    ]);

    scheduler.advanceBy(400);

    assert.deepEqual(stripConversationPositions(events), [
      {
        kind: 'conversation-item-upserted',
        threadId: 'thread-1',
        revision: 1,
        item: {
          id: 'assistant-1',
          kind: 'message',
          role: 'assistant',
          text: 'partial answer',
        },
      },
      {
        kind: 'conversation-item-upserted',
        threadId: 'thread-1',
        revision: 2,
        item: {
          id: 'error:turn-1',
          kind: 'error',
          message: 'stream disconnected',
        },
      },
    ]);
  });

  test('runtime error flushes only pending assistant deltas from the same turn', () => {
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
      turnId: 'turn-1',
      itemId: 'assistant-turn-1',
      deltaKind: 'agent-message',
      text: 'turn one partial',
    });
    service.apply({
      kind: 'record-runtime-item-delta',
      threadId: 'thread-1',
      turnId: 'turn-2',
      itemId: 'assistant-turn-2',
      deltaKind: 'agent-message',
      text: 'turn two partial',
    });
    scheduler.advanceBy(100);

    service.apply({
      kind: 'record-runtime-error',
      threadId: 'thread-1',
      turnId: 'turn-1',
      error: {
        code: null,
        message: 'turn one failed',
      },
    });

    assert.deepEqual(stripConversationPositions(events), [
      {
        kind: 'conversation-item-upserted',
        threadId: 'thread-1',
        revision: 1,
        item: {
          id: 'assistant-turn-1',
          kind: 'message',
          role: 'assistant',
          text: 'turn one partial',
        },
      },
      {
        kind: 'conversation-item-upserted',
        threadId: 'thread-1',
        revision: 2,
        item: {
          id: 'error:turn-1',
          kind: 'error',
          message: 'turn one failed',
        },
      },
    ]);

    scheduler.advanceBy(400);

    assert.deepEqual(stripConversationPositions(events), [
      {
        kind: 'conversation-item-upserted',
        threadId: 'thread-1',
        revision: 1,
        item: {
          id: 'assistant-turn-1',
          kind: 'message',
          role: 'assistant',
          text: 'turn one partial',
        },
      },
      {
        kind: 'conversation-item-upserted',
        threadId: 'thread-1',
        revision: 2,
        item: {
          id: 'error:turn-1',
          kind: 'error',
          message: 'turn one failed',
        },
      },
      {
        kind: 'conversation-item-upserted',
        threadId: 'thread-1',
        revision: 3,
        item: {
          id: 'assistant-turn-2',
          kind: 'message',
          role: 'assistant',
          text: 'turn two partial',
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
      turnId: 'turn-1',
      itemId: 'assistant-1',
      deltaKind: 'agent-message',
      text: '你',
    });
    scheduler.advanceBy(500);
    service.apply({
      kind: 'record-runtime-item-delta',
      threadId: 'thread-1',
      turnId: 'turn-1',
      itemId: 'assistant-1',
      deltaKind: 'agent-message',
      text: '好',
    });
    scheduler.advanceBy(500);

    assert.deepEqual(stripConversationPositions(events), [
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
      status: 'ready',
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
      turnId: 'turn-1',
      itemId: 'assistant-1',
      deltaKind: 'agent-message',
      text: '世界',
    });
    scheduler.advanceBy(500);

    assert.deepEqual(stripConversationPositions(events), [
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
      turnId: 'turn-1',
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

    assert.deepEqual(stripConversationPositions(events), [
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
      turnId: 'turn-1',
      itemId: 'shared-item',
      deltaKind: 'agent-message',
      text: 'thread one',
    });
    service.apply({
      kind: 'record-runtime-item-delta',
      threadId: 'thread-2',
      turnId: 'turn-1',
      itemId: 'shared-item',
      deltaKind: 'agent-message',
      text: 'thread two',
    });

    scheduler.advanceBy(500);

    assert.deepEqual(stripConversationPositions(events), [
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
      status: 'ready',
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
      status: 'ready',
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
      turnId: 'turn-1',
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

    assert.deepEqual(stripConversationPositions(events), [
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

    assert.deepEqual(stripConversationPositions(events), [
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
      turnId: 'turn-1',
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
      turns: null,
    });

    scheduler.advanceBy(500);

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
              id: 'user-restored',
              kind: 'message',
              role: 'user',
              text: 'restored hello',
            },
          ],
        },
      },
    ]);
    assert.deepEqual(service.snapshot({ threadId: 'thread-1' }), {
      status: 'ready',
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

  test('delayed assistant delta flush keeps server-authoritative order before later work trace', () => {
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
      turnId: 'turn-1',
      itemId: 'assistant-1',
      deltaKind: 'agent-message',
      text: 'delayed assistant',
    });
    service.apply({
      kind: 'record-runtime-thread-item',
      threadId: 'thread-1',
      item: {
        itemId: 'command-1',
        itemKind: 'commandExecution',
        status: 'completed',
        text: null,
        command: 'npm test',
        cwd: null,
        processId: null,
        source: null,
        commandActions: [],
        aggregatedOutput: null,
        exitCode: 0,
        durationMs: null,
        raw: {
          type: 'commandExecution',
          id: 'command-1',
          command: 'npm test',
        },
      },
    });

    scheduler.advanceBy(500);

    assert.deepEqual(events, [
      {
        kind: 'conversation-item-upserted',
        threadId: 'thread-1',
        revision: 1,
        item: {
          id: 'command-1',
          kind: 'work-trace',
          codexType: 'commandExecution',
          fields: [
            { name: 'type', value: 'commandExecution' },
            { name: 'id', value: 'command-1' },
            { name: 'command', value: 'npm test' },
          ],
        },
        position: { kind: 'append' },
      },
      {
        kind: 'conversation-item-upserted',
        threadId: 'thread-1',
        revision: 2,
        item: {
          id: 'assistant-1',
          kind: 'message',
          role: 'assistant',
          text: 'delayed assistant',
        },
        position: { kind: 'before-item', itemId: 'command-1' },
      },
    ]);
    assert.deepEqual(service.snapshot({ threadId: 'thread-1' }), {
      status: 'ready',
      revision: 2,
      items: [
        {
          id: 'assistant-1',
          kind: 'message',
          role: 'assistant',
          text: 'delayed assistant',
        },
        {
          id: 'command-1',
          kind: 'work-trace',
          codexType: 'commandExecution',
          fields: [
            { name: 'type', value: 'commandExecution' },
            { name: 'id', value: 'command-1' },
            { name: 'command', value: 'npm test' },
          ],
        },
      ],
    });
  });

  test('command output delta is aggregated as a work trace item snapshot', () => {
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
      turnId: 'turn-1',
      itemId: 'command-1',
      deltaKind: 'command-output',
      text: 'line 1\n',
      data: { stream: 'out' },
    });
    service.apply({
      kind: 'record-runtime-item-delta',
      threadId: 'thread-1',
      turnId: 'turn-1',
      itemId: 'command-1',
      deltaKind: 'command-output',
      text: 'line 2',
    });

    scheduler.advanceBy(500);

    assert.deepEqual(events, [
      {
        kind: 'conversation-item-upserted',
        threadId: 'thread-1',
        revision: 1,
        item: {
          id: 'command-1',
          kind: 'work-trace',
          codexType: 'commandExecution',
          fields: [
            { name: 'id', value: 'command-1' },
            { name: 'type', value: 'commandExecution' },
            { name: 'aggregatedOutput', value: 'line 1\nline 2' },
            { name: 'terminalInput', value: '' },
          ],
        },
        position: { kind: 'append' },
      },
    ]);
  });

  test('reasoning summary and content deltas for the same item are kept in one snapshot', () => {
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
      turnId: 'turn-1',
      itemId: 'reasoning-1',
      deltaKind: 'reasoning-summary-text',
      text: 'summary',
      data: { summaryIndex: 0 },
    });
    service.apply({
      kind: 'record-runtime-item-delta',
      threadId: 'thread-1',
      turnId: 'turn-1',
      itemId: 'reasoning-1',
      deltaKind: 'reasoning-text',
      text: 'content',
      data: { contentIndex: 0 },
    });

    scheduler.advanceBy(500);

    assert.deepEqual(events, [
      {
        kind: 'conversation-item-upserted',
        threadId: 'thread-1',
        revision: 1,
        item: {
          id: 'reasoning-1',
          kind: 'work-trace',
          codexType: 'reasoning',
          fields: [
            { name: 'id', value: 'reasoning-1' },
            { name: 'type', value: 'reasoning' },
            { name: 'summary', value: ['summary'] },
            { name: 'content', value: ['content'] },
          ],
        },
        position: { kind: 'append' },
      },
    ]);
  });

  test('file change output and patch updates for the same item are kept in one snapshot', () => {
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
      turnId: 'turn-1',
      itemId: 'file-1',
      deltaKind: 'file-change-output',
      text: 'patched file\n',
      data: null,
    });
    service.apply({
      kind: 'record-runtime-item-delta',
      threadId: 'thread-1',
      turnId: 'turn-1',
      itemId: 'file-1',
      deltaKind: 'file-change-patch',
      text: null,
      data: {
        changes: [
          { path: 'src/app.ts', status: 'modified' },
        ],
      },
    });

    scheduler.advanceBy(500);

    assert.deepEqual(events, [
      {
        kind: 'conversation-item-upserted',
        threadId: 'thread-1',
        revision: 1,
        item: {
          id: 'file-1',
          kind: 'work-trace',
          codexType: 'fileChange',
          fields: [
            { name: 'id', value: 'file-1' },
            { name: 'type', value: 'fileChange' },
            { name: 'output', value: 'patched file\n' },
            { name: 'changes', value: [{ path: 'src/app.ts', status: 'modified' }] },
          ],
        },
        position: { kind: 'append' },
      },
    ]);
  });

  test('mcp tool progress deltas accumulate as progress messages', () => {
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
      turnId: 'turn-1',
      itemId: 'mcp-1',
      deltaKind: 'mcp-tool-progress',
      text: 'first',
      data: { message: 'first' },
    });
    service.apply({
      kind: 'record-runtime-item-delta',
      threadId: 'thread-1',
      turnId: 'turn-1',
      itemId: 'mcp-1',
      deltaKind: 'mcp-tool-progress',
      text: 'second',
      data: { message: 'second' },
    });

    scheduler.advanceBy(500);

    assert.deepEqual(events, [
      {
        kind: 'conversation-item-upserted',
        threadId: 'thread-1',
        revision: 1,
        item: {
          id: 'mcp-1',
          kind: 'work-trace',
          codexType: 'mcpToolCall',
          fields: [
            { name: 'id', value: 'mcp-1' },
            { name: 'type', value: 'mcpToolCall' },
            { name: 'progressMessages', value: ['first', 'second'] },
          ],
        },
        position: { kind: 'append' },
      },
    ]);
  });

  test('conflicting delta item kinds for the same item fail explicitly', () => {
    const scheduler = createManualConversationScheduler();
    const service = createConversationService({
      events: {
        publish() {},
        subscribe() {
          return () => {};
        },
      },
      scheduler,
    });

    service.apply({
      kind: 'record-runtime-item-delta',
      threadId: 'thread-1',
      turnId: 'turn-1',
      itemId: 'item-1',
      deltaKind: 'reasoning-text',
      text: 'content',
      data: { contentIndex: 0 },
    });

    assert.throws(() => {
      service.apply({
        kind: 'record-runtime-item-delta',
        threadId: 'thread-1',
        turnId: 'turn-1',
        itemId: 'item-1',
        deltaKind: 'command-output',
        text: 'output',
        data: null,
      });
    }, {
      name: 'ConversationDeltaKindConflictError',
    });


  test('delta kind conflicting with an existing completed item fails explicitly', () => {
    const scheduler = createManualConversationScheduler();
    const service = createConversationService({
      events: {
        publish() {},
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
        itemId: 'item-1',
        itemKind: 'commandExecution',
        status: 'completed',
        text: null,
        command: 'npm test',
        cwd: null,
        processId: null,
        source: null,
        commandActions: [],
        aggregatedOutput: 'done',
        exitCode: 0,
        durationMs: null,
        raw: {
          id: 'item-1',
          type: 'commandExecution',
          aggregatedOutput: 'done',
        },
      },
    });

    assert.throws(() => {
      service.apply({
        kind: 'record-runtime-item-delta',
        threadId: 'thread-1',
        turnId: 'turn-1',
        itemId: 'item-1',
        deltaKind: 'reasoning-text',
        text: 'content',
        data: { contentIndex: 0 },
      });
    }, {
      name: 'ConversationDeltaKindConflictError',
    });
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
