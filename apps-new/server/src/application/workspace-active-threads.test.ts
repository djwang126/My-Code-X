import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createApplication } from './create-application.js';
import type { ClientActionResult } from '@my-code-x/contracts-new';
import { createConversationService } from '../features/conversation/index.js';
import { createSlotService } from '../features/slot/index.js';
import { createThreadService } from '../features/thread/index.js';
import { createThreadActionsService } from '../features/thread-actions/index.js';
import { createTurnService } from '../features/turn/index.js';
import { createWorkspaceService, type WorkspaceRegistry } from '../features/workspace/index.js';
import type {
  AppDataStorePort,
  ClockPort,
  DomainEvent,
  EventBusPort,
  IdPort,
  PathComparisonPort,
  PathInspectionPort,
  RuntimeCommand,
  RuntimeEventHandler,
  RuntimePort,
  RuntimeResult,
} from '../ports/index.js';

describe('workspace active thread application actions', () => {
  test('opens active threads when the current scope is a saved available workspace', async () => {
    const fixture = createApplicationFixture({
      registry: createRegistry([
        createRecord({
          id: 'workspace-record-1',
          cwd: 'D:\\workspaces\\demo',
          name: 'Demo',
        }),
      ]),
      paths: {
        'D:\\workspaces\\demo': createAvailablePath('D:\\workspaces\\demo', 'demo'),
      },
      runtimeResults: [
        {
          kind: 'threads-listed',
          threads: [
            {
              threadId: 'thread-2',
              name: 'Second thread',
              preview: 'Second preview',
              workspace: 'D:\\workspaces\\demo',
              updatedAt: '1770000000',
            },
            {
              threadId: 'thread-1',
              name: '',
              preview: '',
              workspace: 'D:\\workspaces\\demo',
              updatedAt: null,
            },
          ],
          nextCursor: 'next-1',
        },
      ],
    });

    const result = await fixture.application.openWorkspacePanel({
      kind: 'open-workspace-panel',
      scope: createScope({
        workspaceId: 'D:\\workspaces\\demo',
        threadId: 'thread-1',
      }),
      payload: {},
    });

    assert.deepEqual(fixture.runtimeCommands, [
      {
        kind: 'list-threads',
        workspace: 'D:\\workspaces\\demo',
        archived: false,
        limit: 10,
        cursor: null,
        sortKey: 'updated_at',
        sortDirection: 'desc',
      },
    ]);
    assert.deepEqual(result, {
      status: 'accepted',
      snapshot: null,
      events: [],
      workspacePanel: {
        status: 'ready',
        list: {
          persistence: {
            status: 'persistent',
          },
          selectedWorkspaceId: 'D:\\workspaces\\demo',
          items: [
            {
              workspaceId: 'D:\\workspaces\\demo',
              recordRef: 'workspace-record-1',
              name: 'Demo',
              cwd: 'D:\\workspaces\\demo',
              availability: {
                status: 'available',
              },
              selected: true,
              operations: ['rename', 'edit-cwd'],
            },
          ],
        },
        page: {
          kind: 'active-threads',
          workspaceId: 'D:\\workspaces\\demo',
          name: 'Demo',
          cwd: 'D:\\workspaces\\demo',
          resource: {
            status: 'ready',
            items: [
              {
                threadId: 'thread-2',
                name: 'Second thread',
                preview: 'Second preview',
                updatedAtIso: '2026-02-02T02:40:00.000Z',
                current: false,
                cardError: null,
                operation: 'idle',
              },
              {
                threadId: 'thread-1',
                name: '',
                preview: '',
                updatedAtIso: null,
                current: true,
                cardError: null,
                operation: 'idle',
              },
            ],
            nextCursor: 'next-1',
            loadMore: {
              status: 'idle',
            },
          },
        },
      },
    });
  });

  test('opens workspace list without listing threads when the current scope is not saved', async () => {
    const fixture = createApplicationFixture({
      registry: createRegistry([
        createRecord({
          id: 'workspace-record-1',
          cwd: 'D:\\workspaces\\demo',
          name: 'Demo',
        }),
      ]),
      paths: {
        'D:\\workspaces\\demo': createAvailablePath('D:\\workspaces\\demo', 'demo'),
      },
    });

    const result = await fixture.application.openWorkspacePanel({
      kind: 'open-workspace-panel',
      scope: createScope({
        workspaceId: 'D:\\workspaces\\unknown',
        threadId: null,
      }),
      payload: {},
    });

    assert.deepEqual(fixture.runtimeCommands, []);
    const panel = readReadyWorkspacePanel(result);
    assert.deepEqual(panel.page, {
      kind: 'workspace-list',
    });
  });

  test('opens active threads explicitly from a saved available workspace', async () => {
    const fixture = createApplicationFixture({
      registry: createRegistry([
        createRecord({
          id: 'workspace-record-1',
          cwd: 'D:\\workspaces\\demo',
          name: 'Demo',
        }),
      ]),
      paths: {
        'D:\\workspaces\\demo': createAvailablePath('D:\\workspaces\\demo', 'demo'),
      },
      runtimeResults: [
        {
          kind: 'threads-listed',
          threads: [
            {
              threadId: 'thread-2',
              name: 'Second',
              preview: 'Second preview',
              workspace: 'D:\\workspaces\\demo',
              updatedAt: null,
            },
            {
              threadId: 'thread-1',
              name: 'Current',
              preview: 'Current preview',
              workspace: 'D:\\workspaces\\demo',
              updatedAt: null,
            },
          ],
          nextCursor: null,
        },
      ],
    });

    const result = await fixture.application.openWorkspaceActiveThreads({
      kind: 'open-workspace-active-threads',
      scope: createScope({
        workspaceId: 'D:\\workspaces\\demo',
        threadId: 'thread-1',
      }),
      payload: {
        workspaceId: 'D:\\workspaces\\demo',
      },
    });

    assert.deepEqual(fixture.runtimeCommands, [
      {
        kind: 'list-threads',
        workspace: 'D:\\workspaces\\demo',
        archived: false,
        limit: 10,
        cursor: null,
        sortKey: 'updated_at',
        sortDirection: 'desc',
      },
    ]);
    const panel = readReadyWorkspacePanel(result);
    const page = readActiveThreadsPage(panel.page);
    assert.equal(panel.list.selectedWorkspaceId, 'D:\\workspaces\\demo');
    assert.deepEqual(page.resource, {
      status: 'ready',
      items: [
        {
          threadId: 'thread-2',
          name: 'Second',
          preview: 'Second preview',
          updatedAtIso: null,
          current: false,
          cardError: null,
          operation: 'idle',
        },
        {
          threadId: 'thread-1',
          name: 'Current',
          preview: 'Current preview',
          updatedAtIso: null,
          current: true,
          cardError: null,
          operation: 'idle',
        },
      ],
      nextCursor: null,
      loadMore: {
        status: 'idle',
      },
    });
  });

  test('represents an empty active thread first page as ready empty items', async () => {
    const fixture = createApplicationFixture({
      registry: createRegistry([
        createRecord({
          id: 'workspace-record-1',
          cwd: 'D:\\workspaces\\demo',
          name: 'Demo',
        }),
      ]),
      paths: {
        'D:\\workspaces\\demo': createAvailablePath('D:\\workspaces\\demo', 'demo'),
      },
      runtimeResults: [
        {
          kind: 'threads-listed',
          threads: [],
          nextCursor: null,
        },
      ],
    });

    const result = await fixture.application.openWorkspacePanel({
      kind: 'open-workspace-panel',
      scope: createScope({
        workspaceId: 'D:\\workspaces\\demo',
        threadId: null,
      }),
      payload: {},
    });

    const page = readActiveThreadsPage(readReadyWorkspacePanel(result).page);
    assert.deepEqual(page.resource, {
      status: 'ready',
      items: [],
      nextCursor: null,
      loadMore: {
        status: 'idle',
      },
    });
  });

  test('load more active threads uses the provided cursor and preserves runtime order', async () => {
    const fixture = createApplicationFixture({
      registry: createRegistry([
        createRecord({
          id: 'workspace-record-1',
          cwd: 'D:\\workspaces\\demo',
          name: 'Demo',
        }),
      ]),
      paths: {
        'D:\\workspaces\\demo': createAvailablePath('D:\\workspaces\\demo', 'demo'),
      },
      runtimeResults: [
        {
          kind: 'threads-listed',
          threads: [
            {
              threadId: 'thread-4',
              name: 'Fourth',
              preview: 'Fourth preview',
              workspace: 'D:\\workspaces\\demo',
              updatedAt: null,
            },
            {
              threadId: 'thread-3',
              name: 'Third',
              preview: 'Third preview',
              workspace: 'D:\\workspaces\\demo',
              updatedAt: null,
            },
          ],
          nextCursor: null,
        },
      ],
    });

    const result = await fixture.application.loadMoreWorkspaceActiveThreads({
      kind: 'load-more-workspace-active-threads',
      scope: createScope({
        workspaceId: 'D:\\workspaces\\demo',
        threadId: 'thread-1',
      }),
      payload: {
        workspaceId: 'D:\\workspaces\\demo',
        cursor: 'next-1',
      },
    });

    assert.deepEqual(fixture.runtimeCommands, [
      {
        kind: 'list-threads',
        workspace: 'D:\\workspaces\\demo',
        archived: false,
        limit: 10,
        cursor: 'next-1',
        sortKey: 'updated_at',
        sortDirection: 'desc',
      },
    ]);
    assert.deepEqual(result, {
      status: 'accepted',
      snapshot: null,
      events: [],
      workspacePanel: {
        status: 'ready',
        list: {
          persistence: {
            status: 'persistent',
          },
          selectedWorkspaceId: 'D:\\workspaces\\demo',
          items: [
            {
              workspaceId: 'D:\\workspaces\\demo',
              recordRef: 'workspace-record-1',
              name: 'Demo',
              cwd: 'D:\\workspaces\\demo',
              availability: {
                status: 'available',
              },
              selected: true,
              operations: ['rename', 'edit-cwd'],
            },
          ],
        },
        page: {
          kind: 'active-threads',
          workspaceId: 'D:\\workspaces\\demo',
          name: 'Demo',
          cwd: 'D:\\workspaces\\demo',
          resource: {
            status: 'ready',
            items: [
              {
                threadId: 'thread-4',
                name: 'Fourth',
                preview: 'Fourth preview',
                updatedAtIso: null,
                current: false,
                cardError: null,
                operation: 'idle',
              },
              {
                threadId: 'thread-3',
                name: 'Third',
                preview: 'Third preview',
                updatedAtIso: null,
                current: false,
                cardError: null,
                operation: 'idle',
              },
            ],
            nextCursor: null,
            loadMore: {
              status: 'idle',
            },
          },
        },
      },
    });
  });

  test('rejects load more active threads when runtime does not return thread list', async () => {
    const fixture = createApplicationFixture({
      registry: createRegistry([
        createRecord({
          id: 'workspace-record-1',
          cwd: 'D:\\workspaces\\demo',
          name: 'Demo',
        }),
      ]),
      paths: {
        'D:\\workspaces\\demo': createAvailablePath('D:\\workspaces\\demo', 'demo'),
      },
      runtimeResults: [
        {
          kind: 'ok',
        },
      ],
    });

    const result = await fixture.application.loadMoreWorkspaceActiveThreads({
      kind: 'load-more-workspace-active-threads',
      scope: createScope({
        workspaceId: 'D:\\workspaces\\demo',
        threadId: 'thread-1',
      }),
      payload: {
        workspaceId: 'D:\\workspaces\\demo',
        cursor: 'next-1',
      },
    });

    assert.deepEqual(fixture.runtimeCommands, [
      {
        kind: 'list-threads',
        workspace: 'D:\\workspaces\\demo',
        archived: false,
        limit: 10,
        cursor: 'next-1',
        sortKey: 'updated_at',
        sortDirection: 'desc',
      },
    ]);
    assert.deepEqual(result, {
      status: 'rejected',
      error: {
        code: 'thread-list-failed',
        message: 'Active thread 列表加载失败',
      },
    });
  });

  test('opens workspace list without listing threads when the current saved workspace is unavailable', async () => {
    const fixture = createApplicationFixture({
      registry: createRegistry([
        createRecord({
          id: 'workspace-record-1',
          cwd: 'D:\\workspaces\\demo',
          name: 'Demo',
        }),
      ]),
      paths: {},
    });

    const result = await fixture.application.openWorkspacePanel({
      kind: 'open-workspace-panel',
      scope: createScope({
        workspaceId: 'D:\\workspaces\\demo',
        threadId: 'thread-1',
      }),
      payload: {},
    });

    assert.deepEqual(fixture.runtimeCommands, []);
    const panel = readReadyWorkspacePanel(result);
    assert.deepEqual(panel.page, {
      kind: 'workspace-list',
    });
    assert.deepEqual(panel.list.items[0]?.availability, {
      status: 'unavailable',
      reason: '路径不存在',
    });
  });

  test('keeps the panel ready when the default active thread first page fails', async () => {
    const fixture = createApplicationFixture({
      registry: createRegistry([
        createRecord({
          id: 'workspace-record-1',
          cwd: 'D:\\workspaces\\demo',
          name: 'Demo',
        }),
      ]),
      paths: {
        'D:\\workspaces\\demo': createAvailablePath('D:\\workspaces\\demo', 'demo'),
      },
      runtimeResults: [
        {
          kind: 'ok',
        },
      ],
    });

    const result = await fixture.application.openWorkspacePanel({
      kind: 'open-workspace-panel',
      scope: createScope({
        workspaceId: 'D:\\workspaces\\demo',
        threadId: 'thread-1',
      }),
      payload: {},
    });

    assert.deepEqual(fixture.runtimeCommands, [
      {
        kind: 'list-threads',
        workspace: 'D:\\workspaces\\demo',
        archived: false,
        limit: 10,
        cursor: null,
        sortKey: 'updated_at',
        sortDirection: 'desc',
      },
    ]);
    assert.deepEqual(result, {
      status: 'accepted',
      snapshot: null,
      events: [],
      workspacePanel: {
        status: 'ready',
        list: {
          persistence: {
            status: 'persistent',
          },
          selectedWorkspaceId: 'D:\\workspaces\\demo',
          items: [
            {
              workspaceId: 'D:\\workspaces\\demo',
              recordRef: 'workspace-record-1',
              name: 'Demo',
              cwd: 'D:\\workspaces\\demo',
              availability: {
                status: 'available',
              },
              selected: true,
              operations: ['rename', 'edit-cwd'],
            },
          ],
        },
        page: {
          kind: 'active-threads',
          workspaceId: 'D:\\workspaces\\demo',
          name: 'Demo',
          cwd: 'D:\\workspaces\\demo',
          resource: {
            status: 'failed',
            error: {
              code: 'thread-list-failed',
              message: 'Active thread 列表加载失败',
            },
          },
        },
      },
    });
  });

  test('rejects opening active threads for an unsaved workspace without listing threads', async () => {
    const fixture = createApplicationFixture({
      registry: createRegistry([]),
      paths: {},
    });

    const result = await fixture.application.openWorkspaceActiveThreads({
      kind: 'open-workspace-active-threads',
      scope: createScope({
        workspaceId: null,
        threadId: null,
      }),
      payload: {
        workspaceId: 'D:\\workspaces\\unknown',
      },
    });

    assert.deepEqual(fixture.runtimeCommands, []);
    assert.deepEqual(result, {
      status: 'rejected',
      error: {
        code: 'workspace-unavailable',
        message: 'Workspace 不可用',
      },
    });
  });

  test('rejects opening active threads for an unavailable saved workspace without listing threads', async () => {
    const fixture = createApplicationFixture({
      registry: createRegistry([
        createRecord({
          id: 'workspace-record-1',
          cwd: 'D:\\workspaces\\demo',
          name: 'Demo',
        }),
      ]),
      paths: {},
    });

    const result = await fixture.application.openWorkspaceActiveThreads({
      kind: 'open-workspace-active-threads',
      scope: createScope({
        workspaceId: 'D:\\workspaces\\demo',
        threadId: null,
      }),
      payload: {
        workspaceId: 'D:\\workspaces\\demo',
      },
    });

    assert.deepEqual(fixture.runtimeCommands, []);
    assert.deepEqual(result, {
      status: 'rejected',
      error: {
        code: 'workspace-unavailable',
        message: 'Workspace 不可用',
      },
    });
  });
});

interface CreateApplicationFixtureInput {
  readonly registry: WorkspaceRegistry;
  readonly paths: Record<string, TestAvailablePath>;
  readonly runtimeResults?: readonly RuntimeResult[];
}

function createApplicationFixture(input: CreateApplicationFixtureInput) {
  const events = createEventBus();
  const runtime = createRuntime(input.runtimeResults ?? []);
  const workspace = createWorkspaceService({
    appData: createMemoryAppDataStore(input.registry),
    paths: createTablePathInspection(input.paths),
    pathComparison: createCaseInsensitivePathComparison(),
    clock: createFixedClock(),
    ids: createSequenceId(),
  });

  return {
    application: createApplication({
      conversation: createConversationService({ events }),
      runtime: runtime.runtime,
      slot: createSlotService({ events }),
      thread: createThreadService({ events }),
      threadActions: createThreadActionsService({ events, runtime: runtime.runtime }),
      turn: createTurnService({ events }),
      workspace,
    }),
    runtimeCommands: runtime.calls,
  };
}

function readReadyWorkspacePanel(result: ClientActionResult): Extract<NonNullable<Extract<ClientActionResult, { readonly status: 'accepted' }>['workspacePanel']>, { readonly status: 'ready' }> {
  assert.equal(result.status, 'accepted');
  const accepted = result as Extract<ClientActionResult, { readonly status: 'accepted' }>;
  assert.equal(accepted.workspacePanel?.status, 'ready');
  return accepted.workspacePanel as Extract<NonNullable<Extract<ClientActionResult, { readonly status: 'accepted' }>['workspacePanel']>, { readonly status: 'ready' }>;
}

function readActiveThreadsPage(page: ReturnType<typeof readReadyWorkspacePanel>['page']) {
  assert.equal(page.kind, 'active-threads');
  return page as Extract<ReturnType<typeof readReadyWorkspacePanel>['page'], { readonly kind: 'active-threads' }>;
}

function createEventBus(): EventBusPort {
  return {
    publish(_event: DomainEvent) {},
    subscribe() {
      return () => {};
    },
  };
}

function createRuntime(results: readonly RuntimeResult[]): { readonly calls: RuntimeCommand[]; readonly runtime: RuntimePort } {
  const calls: RuntimeCommand[] = [];
  const pendingResults = [...results];

  return {
    calls,
    runtime: {
      async send(command) {
        calls.push(command);
        const result = pendingResults.shift();
        if (!result) {
          throw new Error('unexpected runtime command');
        }

        return result;
      },
      subscribe(_handler: RuntimeEventHandler) {
        return () => {};
      },
      async close() {},
    },
  };
}

function createMemoryAppDataStore(registry: WorkspaceRegistry): AppDataStorePort {
  return {
    async readDocument() {
      return JSON.stringify(registry);
    },

    async writeDocumentAtomically() {
      throw new Error('workspace active thread tests do not mutate registry');
    },
  };
}

interface TestAvailablePath {
  readonly canonicalPath: string;
  readonly basename: string;
}

function createTablePathInspection(paths: Record<string, TestAvailablePath>): PathInspectionPort {
  return {
    async inspect(input) {
      const available = paths[input.path];
      if (!available) {
        return {
          status: 'invalid',
          reason: 'missing',
          message: '路径不存在',
        };
      }

      return {
        status: 'available',
        canonicalPath: available.canonicalPath,
        basename: available.basename,
      };
    },
  };
}

function createAvailablePath(canonicalPath: string, basename: string): TestAvailablePath {
  return {
    canonicalPath,
    basename,
  };
}

function createCaseInsensitivePathComparison(): PathComparisonPort {
  return {
    samePath(input) {
      return input.left.toLowerCase() === input.right.toLowerCase();
    },
  };
}

function createFixedClock(): ClockPort {
  return {
    now() {
      return '2026-05-05T00:00:00.000Z';
    },
  };
}

function createSequenceId(): IdPort {
  return {
    createId() {
      return 'workspace-record-new';
    },
  };
}

interface CreateRecordInput {
  readonly id: string;
  readonly cwd: string;
  readonly name: string;
}

function createRecord(input: CreateRecordInput) {
  return {
    id: input.id,
    cwd: input.cwd,
    name: input.name,
    createdAt: '2026-05-05T00:00:00.000Z',
  };
}

function createRegistry(workspaces: WorkspaceRegistry['workspaces']): WorkspaceRegistry {
  return {
    version: 1,
    workspaces,
  };
}

interface CreateScopeInput {
  readonly workspaceId: string | null;
  readonly threadId: string | null;
}

function createScope(input: CreateScopeInput) {
  return {
    slotId: 'slot-1',
    workspaceId: input.workspaceId,
    threadId: input.threadId,
  };
}

