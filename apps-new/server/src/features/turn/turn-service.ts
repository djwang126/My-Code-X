import { applyTurnDomainEvent, createInitialTurnState } from './turn-state.js';
import type { TurnCommand, TurnDomainEvent, TurnSnapshot } from './turn-events.js';
import type { TurnDependencies } from './turn-ports.js';

export interface TurnService {
  apply(input: TurnCommand): TurnSnapshot;
  snapshot(): TurnSnapshot;
}

function createTurnDomainEvent(command: TurnCommand): TurnDomainEvent {
  switch (command.kind) {
    case 'turn-started':
      return {
        kind: 'turn-started',
        threadId: command.threadId,
        turnId: command.turnId,
        startedAt: command.startedAt,
      };

    case 'turn-completed':
      return {
        kind: 'turn-completed',
        threadId: command.threadId,
        turnId: command.turnId,
        status: command.status,
        error: command.error,
        completedAt: command.completedAt,
        durationMs: command.durationMs,
      };

    case 'clear-turn':
      return {
        kind: 'turn-cleared',
        threadId: command.threadId,
      };
  }
}

export function createTurnService(dependencies: TurnDependencies): TurnService {
  let state = createInitialTurnState();

  return {
    apply(input: TurnCommand): TurnSnapshot {
      const event = createTurnDomainEvent(input);
      state = applyTurnDomainEvent({ state, event });
      dependencies.events.publish(event);
      return state;
    },

    snapshot(): TurnSnapshot {
      return state;
    },
  };
}
