import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createRuntimeEventCoordinator } from './runtime-event-coordinator.js';
import { createConversationService, type ConversationService } from '../features/conversation/index.js';
import type { ThreadCommand, ThreadRecord, ThreadService } from '../features/thread/index.js';
import { createTurnService, type TurnCommand, type TurnService } from '../features/turn/index.js';
import type { DomainEvent, DomainEventHandler, EventBusPort, RuntimeEvent } from '../ports/index.js';

interface CoordinatorFixture {
  readonly turnCommands: readonly TurnCommand[];
  readonly coordinator: ReturnType<typeof createRuntimeEventCoordinator>;
}

function createCoordinatorFixture(): CoordinatorFixture {
  const turnCommands: TurnCommand[] = [];

  const turn: TurnService = {
    apply(input) {
      turnCommands.push(input);
      return { current: null };
    },

    snapshot() {
      return {
        current: null,
      };
    },
  };

  return {
    coordinator: createRuntimeEventCoordinator({ turn }),
    turnCommands,
  };
}

interface ConversationCoordinatorFixture {
  readonly conversation: ConversationService;
  readonly coordinator: ReturnType<typeof createRuntimeEventCoordinator>;
  readonly turn: TurnService;
}

function createConversationCoordinatorFixture(): ConversationCoordinatorFixture {
  const events = createTestEventBus();
  const conversation = createConversationService({ events });
  const turn = createTurnService({ events });

  return {
    conversation,
    coordinator: createRuntimeEventCoordinator({ conversation, turn }),
    turn,
  };
}

describe('createRuntimeEventCoordinator', () => {
  test('routes runtime-turn-started events to turn only', () => {
    const fixture = createCoordinatorFixture();
    const event: RuntimeEvent = {
      kind: 'runtime-turn-started',
      threadId: 'thread-1',
      turnId: 'turn-1',
    };

    fixture.coordinator.receive(event);

    assert.deepEqual(fixture.turnCommands, [
      { kind: 'turn-started', threadId: 'thread-1', turnId: 'turn-1', startedAt: null },
    ]);
  });

  test('routes runtime-turn-completed events to turn only', () => {
    const fixture = createCoordinatorFixture();
    const event: RuntimeEvent = {
      error: null,
      kind: 'runtime-turn-completed',
      status: 'completed',
      threadId: 'thread-1',
      turnId: 'turn-1',
    };

    fixture.coordinator.receive(event);

    assert.deepEqual(fixture.turnCommands, [
      {
        completedAt: null,
        durationMs: null,
        error: null,
        kind: 'turn-completed',
        status: 'completed',
        threadId: 'thread-1',
        turnId: 'turn-1',
      },
    ]);
  });

  test('leaves runtime host requests to the host-request migration', () => {
    const fixture = createCoordinatorFixture();
    const event: RuntimeEvent = {
      data: { prompt: 'Approve?' },
      kind: 'runtime-host-requested',
      requestId: 'request-1',
      threadId: 'thread-1',
      turnId: null,
      itemId: null,
    };

    fixture.coordinator.receive(event);

    assert.deepEqual(fixture.turnCommands, []);
  });

  test('turn-scoped runtime-error appears in conversation timeline without completing the turn', () => {
    const fixture = createConversationCoordinatorFixture();

    fixture.coordinator.receive({
      error: {
        code: 'internalServerError',
        message: 'Runtime failed',
      },
      kind: 'runtime-error',
      threadId: 'thread-1',
      turnId: 'turn-1',
    });

    assert.deepEqual(fixture.conversation.snapshot({ threadId: 'thread-1' }), {
      status: 'ready',
      revision: 1,
      items: [
        {
          id: 'error:turn-1',
          kind: 'error',
          message: 'Runtime failed',
        },
      ],
    });
    assert.deepEqual(fixture.turn.snapshot(), { current: null });
  });

  test('failed runtime-turn-completed updates turn lifecycle and appears in conversation timeline', () => {
    const fixture = createConversationCoordinatorFixture();

    fixture.coordinator.receive({
      kind: 'runtime-turn-completed',
      status: 'failed',
      threadId: 'thread-1',
      turnId: 'turn-1',
      error: {
        code: null,
        message: 'turn failed',
      },
    });

    assert.deepEqual(fixture.turn.snapshot(), {
      current: {
        completedAt: null,
        durationMs: null,
        error: {
          code: null,
          message: 'turn failed',
        },
        startedAt: null,
        status: 'failed',
        threadId: 'thread-1',
        turnId: 'turn-1',
      },
    });
    assert.deepEqual(fixture.conversation.snapshot({ threadId: 'thread-1' }), {
      status: 'ready',
      revision: 1,
      items: [
        {
          id: 'error:turn-1',
          kind: 'error',
          message: 'turn failed',
        },
      ],
    });
  });

  test('runtime error and later failed turn completion update one conversation error item for the same turn', () => {
    const fixture = createConversationCoordinatorFixture();

    fixture.coordinator.receive({
      kind: 'runtime-error',
      threadId: 'thread-1',
      turnId: 'turn-1',
      error: {
        code: 'responseStreamDisconnected',
        message: 'first stream error',
      },
    });
    fixture.coordinator.receive({
      kind: 'runtime-turn-completed',
      status: 'failed',
      threadId: 'thread-1',
      turnId: 'turn-1',
      error: {
        code: 'internalServerError',
        message: 'final failed turn error',
      },
    });

    assert.deepEqual(fixture.conversation.snapshot({ threadId: 'thread-1' }), {
      status: 'ready',
      revision: 2,
      items: [
        {
          id: 'error:turn-1',
          kind: 'error',
          message: 'final failed turn error',
        },
      ],
    });
    assert.deepEqual(fixture.turn.snapshot(), {
      current: {
        completedAt: null,
        durationMs: null,
        error: {
          code: 'internalServerError',
          message: 'final failed turn error',
        },
        startedAt: null,
        status: 'failed',
        threadId: 'thread-1',
        turnId: 'turn-1',
      },
    });
  });

  test('runtime errors without a turn id stay outside the conversation timeline', () => {
    const fixture = createConversationCoordinatorFixture();

    fixture.coordinator.receive({
      kind: 'runtime-error',
      threadId: 'thread-1',
      turnId: null,
      error: {
        code: null,
        message: 'stream closed',
      },
    });

    assert.deepEqual(fixture.conversation.snapshot({ threadId: 'thread-1' }), {
      status: 'ready',
      revision: 0,
      items: [],
    });
    assert.deepEqual(fixture.turn.snapshot(), { current: null });
  });

  test('runtime errors without a thread id stay outside the conversation timeline', () => {
    const fixture = createConversationCoordinatorFixture();

    fixture.coordinator.receive({
      kind: 'runtime-error',
      threadId: null,
      turnId: 'turn-1',
      error: {
        code: null,
        message: 'runtime failed',
      },
    });

    assert.deepEqual(fixture.conversation.snapshot({ threadId: 'thread-1' }), {
      status: 'ready',
      revision: 0,
      items: [],
    });
    assert.deepEqual(fixture.turn.snapshot(), { current: null });
  });

  test('failed runtime-turn-completed without an error does not invent a conversation error item', () => {
    const fixture = createConversationCoordinatorFixture();

    fixture.coordinator.receive({
      kind: 'runtime-turn-completed',
      status: 'failed',
      threadId: 'thread-1',
      turnId: 'turn-1',
      error: null,
    });

    assert.deepEqual(fixture.turn.snapshot(), {
      current: {
        completedAt: null,
        durationMs: null,
        error: null,
        startedAt: null,
        status: 'failed',
        threadId: 'thread-1',
        turnId: 'turn-1',
      },
    });
    assert.deepEqual(fixture.conversation.snapshot({ threadId: 'thread-1' }), {
      status: 'ready',
      revision: 0,
      items: [],
    });
  });

  test('runtime errors appear in conversation timeline without changing turn lifecycle', () => {
    const fixture = createConversationCoordinatorFixture();

    fixture.coordinator.receive({
      kind: 'runtime-error',
      threadId: 'thread-1',
      turnId: 'turn-1',
      error: {
        code: 'responseStreamDisconnected',
        message: 'provider stream disconnected, retrying',
      },
    });

    assert.deepEqual(fixture.conversation.snapshot({ threadId: 'thread-1' }), {
      status: 'ready',
      revision: 1,
      items: [
        {
          id: 'error:turn-1',
          kind: 'error',
          message: 'provider stream disconnected, retrying',
        },
      ],
    });
    assert.deepEqual(fixture.turn.snapshot(), { current: null });
  });

  test('leaves runtime-system-notice events to notice migration', () => {
    const fixture = createCoordinatorFixture();
    const event: RuntimeEvent = {
      kind: 'runtime-system-notice',
      level: 'warning',
      message: 'Low context',
      threadId: 'thread-1',
    };

    fixture.coordinator.receive(event);

    assert.deepEqual(fixture.turnCommands, []);
  });

  test('runtime system notices stay outside the conversation timeline', () => {
    const fixture = createConversationCoordinatorFixture();

    fixture.coordinator.receive({
      kind: 'runtime-system-notice',
      level: 'error',
      message: 'system warning',
      threadId: 'thread-1',
    });

    assert.deepEqual(fixture.conversation.snapshot({ threadId: 'thread-1' }), {
      status: 'ready',
      revision: 0,
      items: [],
    });
    assert.deepEqual(fixture.turn.snapshot(), { current: null });
  });

  test('does not open runtime-request state from host request placeholders', () => {
    const fixture = createCoordinatorFixture();

    fixture.coordinator.receive({
      data: { command: 'npm test' },
      kind: 'runtime-host-requested',
      requestId: 'request-1',
      threadId: 'thread-1',
      turnId: null,
      itemId: null,
    });
    fixture.coordinator.receive({
      kind: 'runtime-host-request-resolved',
      requestId: 'request-1',
      threadId: 'thread-1',
    });

    assert.deepEqual(fixture.turnCommands, []);
  });

  test('routes runtime thread lifecycle events to thread metadata when provided', () => {
    const threadCommands: ThreadCommand[] = [];
    const records = new Map<string, ThreadRecord>();
    const thread: ThreadService = {
      remember(input) {
        threadCommands.push(input);
        records.set(input.thread.threadId, input.thread);
        return input.thread;
      },

      rememberMany(input) {
        threadCommands.push(input);
        return { threads: input.threads };
      },

      forget(input) {
        threadCommands.push(input);
        records.delete(input.threadId);
      },

      get(threadId) {
        return records.get(threadId) ?? null;
      },

      snapshot() {
        return { threads: [...records.values()] };
      },
    };
    const coordinator = createRuntimeEventCoordinator({
      thread,
      turn: createNoopTurnService(),
    });

    coordinator.receive({
      kind: 'runtime-thread-started',
      thread: {
        threadId: 'thread-1',
        name: null,
        workspace: '/workspace',
        updatedAt: '1770000000',
      },
    });
    coordinator.receive({
      kind: 'runtime-thread-name-updated',
      name: 'Named thread',
      threadId: 'thread-1',
    });
    coordinator.receive({
      kind: 'runtime-thread-closed',
      threadId: 'thread-1',
    });

    assert.deepEqual(threadCommands, [
      {
        kind: 'remember-thread',
        thread: {
          threadId: 'thread-1',
          name: null,
          updatedAt: '1770000000',
          workspace: '/workspace',
        },
      },
      {
        kind: 'remember-thread',
        thread: {
          threadId: 'thread-1',
          name: 'Named thread',
          updatedAt: '1770000000',
          workspace: '/workspace',
        },
      },
      {
        kind: 'forget-thread',
        threadId: 'thread-1',
      },
    ]);
  });

  test('runtime completed items become observable conversation items through the conversation feature', () => {
    const fixture = createConversationCoordinatorFixture();

    fixture.coordinator.receive({
      kind: 'runtime-item-completed',
      threadId: 'thread-1',
      turnId: 'turn-1',
      item: {
        itemId: 'item-1',
        itemKind: 'agentMessage',
        status: null,
        text: 'hello',
        phase: null,
        memoryCitation: null,
      },
    });

    assert.deepEqual(fixture.conversation.snapshot({ threadId: 'thread-1' }), {
      status: 'ready',
      revision: 1,
      items: [
        {
          id: 'item-1',
          kind: 'message',
          role: 'assistant',
          text: 'hello',
        },
      ],
    });
  });

  test('runtime agent-message deltas become observable conversation updates after aggregation flush', () => {
    const events = createTestEventBus();
    const scheduler = createManualScheduler();
    const conversation = createConversationService({
      events,
      scheduler: scheduler.scheduler,
    });
    const coordinator = createRuntimeEventCoordinator({
      conversation,
      turn: createNoopTurnService(),
    });

    coordinator.receive({
      kind: 'runtime-item-delta',
      threadId: 'thread-1',
      turnId: 'turn-1',
      itemId: 'assistant-1',
      deltaKind: 'agent-message',
      text: 'ok',
      data: {
        threadId: 'thread-1',
        turnId: 'turn-1',
        itemId: 'assistant-1',
        delta: 'ok',
      },
    });

    assert.deepEqual(conversation.snapshot({ threadId: 'thread-1' }), {
      status: 'ready',
      revision: 0,
      items: [],
    });

    scheduler.flushAll();

    assert.deepEqual(conversation.snapshot({ threadId: 'thread-1' }), {
      status: 'ready',
      revision: 1,
      items: [
        {
          id: 'assistant-1',
          kind: 'message',
          role: 'assistant',
          text: 'ok',
        },
      ],
    });
  });

  test('runtime turn plan updates are routed into conversation', () => {
    const fixture = createConversationCoordinatorFixture();

    fixture.coordinator.receive({
      kind: 'runtime-turn-plan-updated',
      threadId: 'thread-1',
      turnId: 'turn-1',
      explanation: 'plan',
      plan: [{ step: 'Read', status: 'pending' }],
    });

    assert.deepEqual(fixture.conversation.snapshot({ threadId: 'thread-1' }), {
      status: 'ready',
      revision: 1,
      items: [
        {
          id: 'plan:turn-1',
          kind: 'work-trace',
          codexType: 'plan',
          fields: [
            { name: 'turnId', value: 'turn-1' },
            { name: 'explanation', value: 'plan' },
            { name: 'plan', value: [{ step: 'Read', status: 'pending' }] },
          ],
        },
      ],
    });
  });

  test('runtime turn diff updates are routed into conversation', () => {
    const fixture = createConversationCoordinatorFixture();

    fixture.coordinator.receive({
      kind: 'runtime-turn-diff-updated',
      threadId: 'thread-1',
      turnId: 'turn-1',
      diff: 'diff --git a/app.ts b/app.ts',
    });

    assert.deepEqual(fixture.conversation.snapshot({ threadId: 'thread-1' }), {
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
  });
});

function createNoopTurnService(): TurnService {
  return {
    apply() {
      return { current: null };
    },

    snapshot() {
      return { current: null };
    },
  };
}

function createTestEventBus(): EventBusPort {
  const handlers = new Set<DomainEventHandler>();

  return {
    publish(event: DomainEvent) {
      for (const handler of handlers) {
        handler(event);
      }
    },

    subscribe(handler: DomainEventHandler) {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
  };
}

function createManualScheduler() {
  const tasks: Array<() => void> = [];

  return {
    scheduler: {
      schedule(input: { readonly delayMs: number; run(): void }) {
        tasks.push(input.run);
        return {
          cancel() {},
        };
      },
    },

    flushAll() {
      for (const task of [...tasks]) {
        task();
      }
      tasks.length = 0;
    },
  };
}
