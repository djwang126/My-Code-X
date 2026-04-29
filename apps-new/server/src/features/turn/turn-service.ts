import { applyTurnDomainEvent, createInitialTurnState } from './turn-state.js';
import type { TurnCommand, TurnDomainEvent, TurnSnapshot } from './turn-events.js';
import type { TurnDependencies } from './turn-ports.js';

export interface TurnService {
  apply(input: TurnCommand): TurnSnapshot;
  snapshot(): TurnSnapshot;
}

function createTurnDomainEvent(command: TurnCommand): TurnDomainEvent {
  switch (command.kind) {
    case 'start-turn':
      return {
        kind: 'turn-started',
        turnId: command.turnId,
      };

    case 'mark-turn-waiting':
      return {
        kind: 'turn-waiting',
        turnId: command.turnId,
      };

    case 'finish-turn':
      return {
        kind: 'turn-finished',
        turnId: command.turnId,
        outcome: command.outcome,
      };

    case 'reset-turn':
      return {
        kind: 'turn-reset',
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
