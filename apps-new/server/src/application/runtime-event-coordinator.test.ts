import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createRuntimeEventCoordinator } from './runtime-event-coordinator.js';
import type { ConversationCommand, ConversationService } from '../features/conversation/index.js';
import type { ThreadCommand, ThreadRecord, ThreadService } from '../features/thread/index.js';
import type { TurnCommand, TurnService } from '../features/turn/index.js';
import type { RuntimeEvent } from '../ports/index.js';

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

interface ConversationCommandCollector {
  readonly commands: readonly ConversationCommand[];
  readonly conversation: ConversationService;
}

function createConversationCommandCollector(): ConversationCommandCollector {
  const commands: ConversationCommand[] = [];

  return {
    commands,
    conversation: {
      apply(input) {
        commands.push(input);
        return {
          revision: 0,
          items: [],
        };
      },

      snapshot() {
        return {
          revision: 0,
          items: [],
        };
      },
    },
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

  test('routes runtime-error events to turn when a turn is present', () => {
    const fixture = createCoordinatorFixture();
    const event: RuntimeEvent = {
      error: {
        code: 'RUNTIME_FAILED',
        message: 'Runtime failed',
      },
      kind: 'runtime-error',
      threadId: 'thread-1',
      turnId: 'turn-1',
    };

    fixture.coordinator.receive(event);

    assert.deepEqual(fixture.turnCommands, [
      {
        completedAt: null,
        durationMs: null,
        error: {
          code: 'RUNTIME_FAILED',
          message: 'Runtime failed',
        },
        kind: 'turn-completed',
        status: 'failed',
        threadId: 'thread-1',
        turnId: 'turn-1',
      },
    ]);
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
        title: null,
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
          title: null,
          updatedAt: '1770000000',
          workspace: '/workspace',
        },
      },
      {
        kind: 'remember-thread',
        thread: {
          threadId: 'thread-1',
          title: 'Named thread',
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

  test('routes runtime items to conversation without classifying them in application', () => {
    const collector = createConversationCommandCollector();
    const coordinator = createRuntimeEventCoordinator({
      conversation: collector.conversation,
      turn: createNoopTurnService(),
    });

    coordinator.receive({
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

    assert.deepEqual(collector.commands, [
      {
        kind: 'record-runtime-thread-item',
        threadId: 'thread-1',
        item: {
          itemId: 'item-1',
          itemKind: 'agentMessage',
          status: null,
          text: 'hello',
          phase: null,
          memoryCitation: null,
        },
      },
    ]);
  });

  test('routes runtime item deltas to conversation without classifying them in application', () => {
    const collector = createConversationCommandCollector();
    const coordinator = createRuntimeEventCoordinator({
      conversation: collector.conversation,
      turn: createNoopTurnService(),
    });

    coordinator.receive({
      kind: 'runtime-item-delta',
      threadId: 'thread-1',
      turnId: 'turn-1',
      itemId: 'command-1',
      deltaKind: 'command-output',
      text: 'ok',
      data: {
        threadId: 'thread-1',
        turnId: 'turn-1',
        itemId: 'command-1',
        delta: 'ok',
      },
    });

    assert.deepEqual(collector.commands, [
      {
        kind: 'record-runtime-item-delta',
        threadId: 'thread-1',
        itemId: 'command-1',
        deltaKind: 'command-output',
        text: 'ok',
      },
    ]);
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
