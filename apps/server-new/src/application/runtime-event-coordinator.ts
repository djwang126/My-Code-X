import type { SessionService } from '../features/session/index.js';
import type { ThreadService } from '../features/thread/index.js';
import type { TurnService } from '../features/turn/index.js';
import type { RuntimeEvent } from '../ports/index.js';

export interface RuntimeEventCoordinatorInput {
  readonly session: SessionService;
  readonly thread: ThreadService;
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
          input.thread.receiveRuntimeEvent(event);
          input.turn.apply({
            kind: 'start-turn',
            turnId: event.turnId,
          });
          return;

        case 'runtime-output-updated':
          // Intentionally not projected in the skeleton. Conversation item
          // semantics must be migrated with the real transcript feature.
          return;

        case 'runtime-turn-completed':
          input.turn.apply({
            kind: 'finish-turn',
            turnId: event.turnId,
            outcome: event.status,
          });
          return;

        case 'runtime-input-requested':
          input.session.receiveRuntimeEvent(event);
          // Runtime request interaction semantics are migrated separately.
          return;

        case 'runtime-error':
          input.session.receiveRuntimeEvent(event);
          if (event.turnId) {
            input.turn.apply({
              kind: 'finish-turn',
              turnId: event.turnId,
              outcome: 'failed',
            });
          }
          return;

        case 'runtime-system-notice':
          input.session.receiveRuntimeEvent(event);
          return;
      }
    },
  };
}
