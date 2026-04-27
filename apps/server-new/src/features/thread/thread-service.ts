import { applyThreadDomainEvent, createInitialThreadState } from './thread-state.js';
import type { ThreadCommand, ThreadDomainEvent, ThreadRuntimeEvent, ThreadSnapshot } from './thread-events.js';
import type { ThreadDependencies } from './thread-ports.js';
import type { RuntimeCommand } from '../../ports/index.js';

export interface ThreadService {
  start(input: ThreadCommand): Promise<ThreadSnapshot>;
  receiveRuntimeEvent(event: ThreadRuntimeEvent): void;
  snapshot(): ThreadSnapshot;
}

function toRuntimeCommand(command: ThreadCommand): RuntimeCommand {
  switch (command.kind) {
    case 'create-thread':
      return {
        kind: 'start-thread',
        workspace: command.workspace,
        runtimeSettings: command.runtimeSettings,
        baseInstructions: command.baseInstructions,
      };

    case 'open-thread':
      return {
        kind: 'resume-thread',
        threadId: command.threadId,
        workspace: command.workspace,
        runtimeSettings: command.runtimeSettings,
        baseInstructions: command.baseInstructions,
      };

    case 'list-workspace-threads':
      return {
        kind: 'list-threads',
        workspace: command.workspace,
        limit: command.limit,
        archived: command.archived,
      };
  }
}

function interpretThreadRuntimeEvent(event: ThreadRuntimeEvent): ThreadDomainEvent {
  return {
    kind: 'thread-turn-attached',
    threadId: event.threadId,
    turnId: event.turnId,
  };
}

export function createThreadService(dependencies: ThreadDependencies): ThreadService {
  let state = createInitialThreadState();

  return {
    async start(input: ThreadCommand): Promise<ThreadSnapshot> {
      const result = await dependencies.runtime.send(toRuntimeCommand(input));

      if (result.kind === 'thread-started' || result.kind === 'thread-resumed') {
        state = applyThreadDomainEvent({ state, event: { kind: 'thread-started', threadId: result.threadId } });
      }

      if (result.kind === 'threads-listed') {
        state = applyThreadDomainEvent({ state, event: { kind: 'threads-listed', threads: result.threads } });
      }

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
