import type {
  CreateThreadCommand,
  OpenThreadCommand,
  OpenThreadActionResult,
  ThreadActionResult,
  ThreadActionsDomainEvent,
} from './thread-actions-events.js';
import type { ThreadActionsDependencies } from './thread-actions-ports.js';
import { BoundaryError } from '../../shared/index.js';

export interface ThreadActionsService {
  create(input: CreateThreadCommand): Promise<ThreadActionResult>;
  open(input: OpenThreadCommand): Promise<OpenThreadActionResult>;
}

function publishThreadActionEvent(dependencies: ThreadActionsDependencies, event: ThreadActionsDomainEvent) {
  dependencies.events.publish(event);
}

export function createThreadActionsService(dependencies: ThreadActionsDependencies): ThreadActionsService {
  return {
    async create(input: CreateThreadCommand): Promise<ThreadActionResult> {
      const result = await dependencies.runtime.send({
        kind: 'start-thread',
        workspace: input.workspace,
        runtimeSettings: null,
        baseInstructions: null,
      });

      if (result.kind !== 'thread-started') {
        throw new BoundaryError('runtime did not start a thread');
      }

      const thread = {
        threadId: result.threadId,
        workspace: input.workspace,
        name: null,
        updatedAt: null,
      };
      publishThreadActionEvent(dependencies, { kind: 'thread-created', thread });
      return thread;
    },

    async open(input: OpenThreadCommand): Promise<OpenThreadActionResult> {
      const result = await dependencies.runtime.send({
        kind: 'resume-thread',
        threadId: input.threadId,
        workspace: input.workspace,
        runtimeSettings: null,
        baseInstructions: null,
      });

      if (result.kind !== 'thread-resumed') {
        return {
          status: 'failed',
          error: {
            message: 'runtime did not open the requested thread',
          },
        };
      }

      const thread = {
        threadId: result.threadId,
        workspace: input.workspace,
        name: result.snapshot.name,
        updatedAt: null,
      };
      publishThreadActionEvent(dependencies, { kind: 'thread-opened', thread });
      return {
        status: 'ready',
        thread,
        restoredItems: result.snapshot.items,
        restoredTurns: result.snapshot.turns ?? null,
      };
    },
  };
}
