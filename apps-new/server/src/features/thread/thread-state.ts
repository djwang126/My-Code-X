import type { ThreadDomainEvent, ThreadSnapshot } from './thread-events.js';

export type ThreadState = ThreadSnapshot;

export function createInitialThreadState(): ThreadState {
  return {
    currentThreadId: null,
    activeTurnId: null,
    threads: [],
  };
}

export function applyThreadDomainEvent(input: ApplyThreadDomainEventInput): ThreadState {
  const { state, event } = input;

  switch (event.kind) {
    case 'thread-started':
      return {
        ...state,
        currentThreadId: event.threadId,
      };

    case 'thread-turn-attached':
      return {
        ...state,
        currentThreadId: event.threadId,
        activeTurnId: event.turnId,
      };

    case 'threads-listed':
      return {
        ...state,
        threads: event.threads,
      };
  }
}

export interface ApplyThreadDomainEventInput {
  readonly state: ThreadState;
  readonly event: ThreadDomainEvent;
}
