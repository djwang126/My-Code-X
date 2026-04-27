import type { ChatService } from '../features/chat/index.js';
import type { SessionService } from '../features/session/index.js';
import type { ThreadService } from '../features/thread/index.js';
import type { RuntimeEvent } from '../ports/index.js';

export interface RuntimeEventCoordinatorInput {
  readonly chat: ChatService;
  readonly session: SessionService;
  readonly thread: ThreadService;
}

export interface RuntimeEventCoordinator {
  receive(event: RuntimeEvent): void;
}

export function createRuntimeEventCoordinator(input: RuntimeEventCoordinatorInput): RuntimeEventCoordinator {
  return {
    receive(event: RuntimeEvent) {
      switch (event.kind) {
        case 'runtime-turn-started':
          input.chat.receiveRuntimeEvent(event);
          input.thread.receiveRuntimeEvent(event);
          return;

        case 'runtime-output-updated':
        case 'runtime-turn-completed':
          input.chat.receiveRuntimeEvent(event);
          return;

        case 'runtime-input-requested':
          input.chat.receiveRuntimeEvent(event);
          input.session.receiveRuntimeEvent(event);
          return;

        case 'runtime-error':
        case 'runtime-system-notice':
          input.session.receiveRuntimeEvent(event);
          return;
      }
    },
  };
}
