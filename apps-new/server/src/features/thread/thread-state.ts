import type { ThreadDomainEvent, ThreadRecord, ThreadSnapshot } from './thread-events.js';

export type ThreadState = ThreadSnapshot;

export function createInitialThreadState(): ThreadState {
  return {
    threads: [],
  };
}

export interface ApplyThreadDomainEventInput {
  readonly state: ThreadState;
  readonly event: ThreadDomainEvent;
}

export function applyThreadDomainEvent(input: ApplyThreadDomainEventInput): ThreadState {
  const { state, event } = input;

  switch (event.kind) {
    case 'thread-remembered':
      return {
        threads: upsertThreadRecord(state.threads, event.thread),
      };

    case 'threads-remembered':
      return {
        threads: upsertThreadRecords(state.threads, event.threads),
      };

    case 'thread-forgotten':
      return {
        threads: state.threads.filter(thread => thread.threadId !== event.threadId),
      };
  }
}

function upsertThreadRecords(
  threads: readonly ThreadRecord[],
  nextThreads: readonly ThreadRecord[],
): readonly ThreadRecord[] {
  let result = threads;

  for (const nextThread of nextThreads) {
    result = upsertThreadRecord(result, nextThread);
  }

  return result;
}

function upsertThreadRecord(threads: readonly ThreadRecord[], nextThread: ThreadRecord): readonly ThreadRecord[] {
  const index = threads.findIndex(thread => thread.threadId === nextThread.threadId);

  if (index === -1) {
    return [...threads, nextThread];
  }

  return threads.map((thread, threadIndex) => threadIndex === index ? nextThread : thread);
}
