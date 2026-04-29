import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createRuntimeEventCoordinator } from './runtime-event-coordinator.js';
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
      return input.kind === 'reset-turn'
        ? { lifecycle: 'idle', activeTurnId: null }
        : { lifecycle: 'starting', activeTurnId: input.turnId };
    },

    snapshot() {
      return {
        lifecycle: 'idle',
        activeTurnId: null,
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

    assert.deepEqual(fixture.turnCommands, [{ kind: 'start-turn', turnId: 'turn-1' }]);
  });

  test('leaves runtime-output-updated projection to the conversation migration', () => {
    const fixture = createCoordinatorFixture();
    const event: RuntimeEvent = {
      itemId: 'item-1',
      kind: 'runtime-output-updated',
      outputKind: 'text-delta',
      text: 'hello',
      threadId: 'thread-1',
      turnId: 'turn-1',
    };

    fixture.coordinator.receive(event);

    assert.deepEqual(fixture.turnCommands, []);
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

    assert.deepEqual(fixture.turnCommands, [{ kind: 'finish-turn', turnId: 'turn-1', outcome: 'completed' }]);
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

    assert.deepEqual(fixture.turnCommands, [{ kind: 'finish-turn', turnId: 'turn-1', outcome: 'failed' }]);
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
});
