import type { TurnDomainEvent, TurnSnapshot } from './turn-events.js';

export type TurnState = TurnSnapshot;

export function createInitialTurnState(): TurnState {
  return {
    lifecycle: 'idle',
    activeTurnId: null,
  };
}

export interface ApplyTurnDomainEventInput {
  readonly state: TurnState;
  readonly event: TurnDomainEvent;
}

export function applyTurnDomainEvent(input: ApplyTurnDomainEventInput): TurnState {
  const { event } = input;

  switch (event.kind) {
    case 'turn-started':
      return {
        lifecycle: 'starting',
        activeTurnId: event.turnId,
      };

    case 'turn-waiting':
      return {
        lifecycle: 'waiting-for-input',
        activeTurnId: event.turnId,
      };

    case 'turn-finished':
      return {
        lifecycle: event.outcome,
        activeTurnId: event.turnId,
      };

    case 'turn-reset':
      return createInitialTurnState();
  }
}
