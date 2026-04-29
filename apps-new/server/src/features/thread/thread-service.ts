import { applyThreadDomainEvent, createInitialThreadState } from './thread-state.js';
import type {
  ForgetThreadCommand,
  RememberThreadCommand,
  RememberThreadsCommand,
  ThreadDomainEvent,
  ThreadRecord,
  ThreadSnapshot,
} from './thread-events.js';
import type { ThreadDependencies } from './thread-ports.js';

export interface ThreadService {
  remember(input: RememberThreadCommand): ThreadRecord;
  rememberMany(input: RememberThreadsCommand): ThreadSnapshot;
  forget(input: ForgetThreadCommand): void;
  get(threadId: string): ThreadRecord | null;
  snapshot(): ThreadSnapshot;
}

export function createThreadService(dependencies: ThreadDependencies): ThreadService {
  let state = createInitialThreadState();

  function publish(event: ThreadDomainEvent) {
    state = applyThreadDomainEvent({ state, event });
    dependencies.events.publish(event);
  }

  return {
    remember(input: RememberThreadCommand): ThreadRecord {
      publish({ kind: 'thread-remembered', thread: input.thread });
      return input.thread;
    },

    rememberMany(input: RememberThreadsCommand): ThreadSnapshot {
      publish({ kind: 'threads-remembered', threads: input.threads });
      return state;
    },

    forget(input: ForgetThreadCommand) {
      publish({ kind: 'thread-forgotten', threadId: input.threadId });
    },

    get(threadId: string): ThreadRecord | null {
      return state.threads.find(thread => thread.threadId === threadId) ?? null;
    },

    snapshot(): ThreadSnapshot {
      return state;
    },
  };
}
