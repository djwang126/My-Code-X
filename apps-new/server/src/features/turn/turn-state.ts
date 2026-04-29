import type { TurnDomainEvent, TurnSnapshot } from './turn-events.js';

export type TurnState = TurnSnapshot;

export function createInitialTurnState(): TurnState {
  return {
    current: null,
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
        current: {
          threadId: event.threadId,
          turnId: event.turnId,
          status: 'inProgress',
          error: null,
          startedAt: event.startedAt,
          completedAt: null,
          durationMs: null,
        },
      };

    case 'turn-completed':
      return {
        current: {
          threadId: event.threadId,
          turnId: event.turnId,
          status: event.status,
          error: event.error,
          startedAt: input.state.current?.turnId === event.turnId ? input.state.current.startedAt : null,
          completedAt: event.completedAt,
          durationMs: event.durationMs,
        },
      };

    case 'turn-cleared':
      return createInitialTurnState();
  }
}
