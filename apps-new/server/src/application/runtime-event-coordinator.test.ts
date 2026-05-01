import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createRuntimeEventCoordinator } from './runtime-event-coordinator.js';
import type { ConversationCommand, ConversationService } from '../features/conversation/index.js';
import type { RuntimeRequestCommand, RuntimeRequestService } from '../features/runtime-request/index.js';
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

  test('leaves runtime-input-requested events to the runtime-request migration', () => {
    const fixture = createCoordinatorFixture();
    const event: RuntimeEvent = {
      inputKind: 'approval',
      kind: 'runtime-input-requested',
      prompt: 'Approve?',
      requestId: 'request-1',
      threadId: 'thread-1',
      title: 'Approval',
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

  test('routes runtime input lifecycle events to runtime requests when provided', () => {
    const runtimeRequestCommands: RuntimeRequestCommand[] = [];
    const runtimeRequests: RuntimeRequestService = {
      apply(input) {
        runtimeRequestCommands.push(input);
        return { requests: [] };
      },

      snapshot() {
        return { requests: [] };
      },
    };
    const fixture = createCoordinatorFixture();
    const coordinator = createRuntimeEventCoordinator({
      runtimeRequests,
      turn: createNoopTurnService(),
    });

    coordinator.receive({
      data: { command: 'npm test' },
      inputKind: 'approval',
      kind: 'runtime-input-requested',
      method: 'item/commandExecution/requestApproval',
      prompt: 'npm test',
      requestId: 'request-1',
      threadId: 'thread-1',
      title: 'Approve command execution',
    });
    coordinator.receive({
      kind: 'runtime-input-resolved',
      requestId: 'request-1',
      threadId: 'thread-1',
    });

    assert.deepEqual(fixture.turnCommands, []);
    assert.deepEqual(runtimeRequestCommands, [
      {
        kind: 'open-runtime-request',
        request: {
          data: { command: 'npm test' },
          id: 'request-1',
          kind: 'approval',
          lifecycle: 'open',
          prompt: 'npm test',
          responseKind: 'decision',
          title: 'Approve command execution',
        },
      },
      {
        kind: 'resolve-runtime-request',
        requestId: 'request-1',
      },
    ]);
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
    const conversationCommands: ConversationCommand[] = [];
    const conversation: ConversationService = {
      apply(input) {
        conversationCommands.push(input);
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
    };
    const coordinator = createRuntimeEventCoordinator({
      conversation,
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

    assert.deepEqual(conversationCommands, [
      {
        kind: 'record-runtime-thread-item',
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
