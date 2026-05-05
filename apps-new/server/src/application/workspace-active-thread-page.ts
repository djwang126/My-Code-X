import type {
  ClientWorkspaceActiveThreadsPageView,
  ClientWorkspaceErrorView,
  ClientWorkspaceThreadItemView,
} from '@my-code-x/contracts-new';
import type { RuntimePort, RuntimeThread } from '../ports/index.js';

export const ACTIVE_THREAD_PAGE_LIMIT = 10;

export interface ActiveThreadWorkspace {
  readonly workspaceId: string;
  readonly name: string;
  readonly cwd: string;
}

export interface CreateActiveThreadPageInput {
  readonly runtime: RuntimePort;
  readonly workspace: ActiveThreadWorkspace;
  readonly currentThreadId: string | null;
  readonly cursor: string | null;
}

export async function createActiveThreadPage(input: CreateActiveThreadPageInput): Promise<ClientWorkspaceActiveThreadsPageView> {
  try {
    const result = await input.runtime.send({
      kind: 'list-threads',
      workspace: input.workspace.workspaceId,
      archived: false,
      limit: ACTIVE_THREAD_PAGE_LIMIT,
      cursor: input.cursor,
      sortKey: 'updated_at',
      sortDirection: 'desc',
    });

    if (result.kind !== 'threads-listed') {
      return createFailedActiveThreadPage({
        workspace: input.workspace,
        error: createThreadListFailedError(),
      });
    }

    return {
      kind: 'active-threads',
      workspaceId: input.workspace.workspaceId,
      name: input.workspace.name,
      cwd: input.workspace.cwd,
      resource: {
        status: 'ready',
        items: result.threads.map(thread => presentThreadItem({
          thread,
          currentThreadId: input.currentThreadId,
        })),
        nextCursor: result.nextCursor ?? null,
        loadMore: {
          status: 'idle',
        },
      },
    };
  } catch {
    return createFailedActiveThreadPage({
      workspace: input.workspace,
      error: createThreadListFailedError(),
    });
  }
}

export interface CreateFailedActiveThreadPageInput {
  readonly workspace: ActiveThreadWorkspace;
  readonly error: ClientWorkspaceErrorView;
}

export function createFailedActiveThreadPage(input: CreateFailedActiveThreadPageInput): ClientWorkspaceActiveThreadsPageView {
  return {
    kind: 'active-threads',
    workspaceId: input.workspace.workspaceId,
    name: input.workspace.name,
    cwd: input.workspace.cwd,
    resource: {
      status: 'failed',
      error: input.error,
    },
  };
}

export function createThreadListFailedError(): ClientWorkspaceErrorView {
  return {
    code: 'thread-list-failed',
    message: 'Active thread 列表加载失败',
  };
}

function presentThreadItem(input: {
  readonly thread: RuntimeThread;
  readonly currentThreadId: string | null;
}): ClientWorkspaceThreadItemView {
  return {
    threadId: input.thread.threadId,
    name: input.thread.name ?? '',
    preview: input.thread.preview ?? '',
    updatedAtIso: normalizeUpdatedAt(input.thread.updatedAt),
    current: input.currentThreadId === input.thread.threadId,
    cardError: null,
    operation: 'idle',
  };
}

function normalizeUpdatedAt(value: string | null): string | null {
  if (value === null || value === '') {
    return null;
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return new Date(numeric * 1000).toISOString();
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return new Date(parsed).toISOString();
}
