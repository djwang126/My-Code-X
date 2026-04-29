import type { RuntimePort, RuntimeThread } from '../../ports/index.js';
import { BoundaryError } from '../../shared/index.js';

export type WorkspaceCommand = InspectWorkspaceCommand | ListWorkspaceThreadsCommand;

export interface InspectWorkspaceCommand {
  readonly kind: 'inspect-workspace';
  readonly workspace: string | null;
}

export interface ListWorkspaceThreadsCommand {
  readonly kind: 'list-workspace-threads';
  readonly workspace: string;
  readonly limit: number;
  readonly archived: boolean;
}

export interface WorkspaceSnapshot {
  readonly workspace: string | null;
  readonly available: boolean;
}

export interface WorkspaceThreadSummary {
  readonly threadId: string;
  readonly title: string | null;
  readonly workspace: string | null;
  readonly updatedAt: string | null;
}

export interface WorkspaceDependencies {
  readonly runtime: RuntimePort;
}

export interface WorkspaceService {
  inspect(input: InspectWorkspaceCommand): Promise<WorkspaceSnapshot>;
  listThreads(input: ListWorkspaceThreadsCommand): Promise<readonly WorkspaceThreadSummary[]>;
}

export function createWorkspaceService(dependencies: WorkspaceDependencies): WorkspaceService {
  return {
    async inspect(input: InspectWorkspaceCommand): Promise<WorkspaceSnapshot> {
      return {
        workspace: input.workspace,
        available: Boolean(input.workspace),
      };
    },

    async listThreads(input: ListWorkspaceThreadsCommand): Promise<readonly WorkspaceThreadSummary[]> {
      const result = await dependencies.runtime.send({
        kind: 'list-threads',
        workspace: input.workspace,
        limit: input.limit,
        archived: input.archived,
      });

      if (result.kind !== 'threads-listed') {
        throw new BoundaryError('runtime did not list workspace threads');
      }

      return result.threads.map(mapRuntimeThreadSummary);
    },
  };
}

function mapRuntimeThreadSummary(thread: RuntimeThread): WorkspaceThreadSummary {
  return {
    threadId: thread.threadId,
    title: thread.title,
    workspace: thread.workspace,
    updatedAt: thread.updatedAt,
  };
}
