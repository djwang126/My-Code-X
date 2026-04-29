import type { TurnService } from '../features/turn/index.js';
import type { RuntimeEvent } from '../ports/index.js';

export interface RuntimeEventCoordinatorInput {
  readonly turn: TurnService;
}

export interface RuntimeEventCoordinator {
  receive(event: RuntimeEvent): void;
}

export function createRuntimeEventCoordinator(input: RuntimeEventCoordinatorInput): RuntimeEventCoordinator {
  return {
    receive(event: RuntimeEvent) {
      switch (event.kind) {
        case 'runtime-turn-started':
          input.turn.apply({
            kind: 'turn-started',
            threadId: event.threadId,
            turnId: event.turnId,
            startedAt: null,
          });
          return;

        case 'runtime-output-updated':
          // Intentionally not projected in the skeleton. Conversation item
          // semantics must be migrated with the real transcript feature.
          return;

        case 'runtime-turn-completed':
          input.turn.apply({
            kind: 'turn-completed',
            threadId: event.threadId,
            turnId: event.turnId,
            status: event.status,
            error: event.error,
            completedAt: null,
            durationMs: null,
          });
          return;

        case 'runtime-input-requested':
          // Runtime request interaction semantics are migrated separately.
          return;

        case 'runtime-error':
          if (event.threadId && event.turnId) {
            input.turn.apply({
              kind: 'turn-completed',
              threadId: event.threadId,
              turnId: event.turnId,
              status: 'failed',
              error: event.error,
              completedAt: null,
              durationMs: null,
            });
          }
          return;

        case 'runtime-system-notice':
          return;
      }
    },
  };
}
