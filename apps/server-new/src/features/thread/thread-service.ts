import { createInitialThreadState } from './thread-state.js';
import type { ThreadCommand, ThreadDomainEvent, ThreadRuntimeEvent, ThreadSnapshot } from './thread-events.js';
import type { ThreadDependencies } from './thread-ports.js';
import type { ThreadState } from './thread-state.js';

export interface ThreadService {
  start(input: ThreadCommand): Promise<ThreadSnapshot>;
  receiveRuntimeEvent(event: ThreadRuntimeEvent): void;
  snapshot(): ThreadSnapshot;
}

function interpretThreadRuntimeEvent(event: ThreadRuntimeEvent): ThreadDomainEvent {
  return event;
}

function applyThreadDomainEvent(input: { state: ThreadState; event: ThreadDomainEvent }): ThreadState {
  void input.state;
  return input.event;
}

export function createThreadService(dependencies: ThreadDependencies): ThreadService {
  let state = createInitialThreadState();

  return {
    async start(input: ThreadCommand): Promise<ThreadSnapshot> {
      await dependencies.runtime.send(input);
      return state;
    },

    receiveRuntimeEvent(event: ThreadRuntimeEvent) {
      const domainEvent = interpretThreadRuntimeEvent(event);
      state = applyThreadDomainEvent({ state, event: domainEvent });
      dependencies.events.publish(domainEvent);
    },

    snapshot(): ThreadSnapshot {
      return state;
    },
  };
}
