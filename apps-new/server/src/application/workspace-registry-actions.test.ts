import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createApplication } from './create-application.js';
import type { ClientActionResult, ClientWorkspacePanelView, ClientWorkspacePersistenceView } from '@my-code-x/contracts-new';
import type { ConversationService } from '../features/conversation/index.js';
import { createSlotService } from '../features/slot/index.js';
import type { ThreadActionsService } from '../features/thread-actions/index.js';
import { createThreadService } from '../features/thread/index.js';
import type { TurnService } from '../features/turn/index.js';
import { createWorkspaceService, type WorkspaceRegistry } from '../features/workspace/index.js';
import { AppDataStoreError, type AppDataStorePort, type ClockPort, type DomainEvent, type EventBusPort, type IdPort, type PathComparisonPort, type PathInspectionPort, type RuntimeCommand, type RuntimeEventHandler, type RuntimePort, type RuntimeResult } from '../ports/index.js';

describe('workspace registry application actions', () => {
  test('opens workspace panel through the real workspace registry service', async () => {
    const fixture = createApplicationFixture({
      registry: createRegistry([
        createRecord({ id: 'workspace-record-1', cwd: 'D:\\workspaces\\demo', name: 'Demo' }),
      ]),
      paths: {
        'D:\\workspaces\\demo': createAvailablePath('D:\\workspaces\\demo', 'demo'),
      },
    });

    const result = await fixture.application.openWorkspacePanel({
      kind: 'open-workspace-panel',
      scope: createScope({ workspaceId: null }),
      payload: {},
    });

    assert.deepEqual(result, createAcceptedWorkspacePanel({
      items: [
        createPanelItem({
          workspaceId: 'D:\\workspaces\\demo',
          recordRef: 'workspace-record-1',
          name: 'Demo',
          cwd: 'D:\\workspaces\\demo',
        }),
      ],
    }));
  });

  test('adds workspace with canonical cwd, basename fallback, and no runtime command', async () => {
    const fixture = createApplicationFixture({
      paths: {
        'D:\\workspaces\\demo': createAvailablePath('D:\\canonical\\demo', 'demo'),
        'D:\\canonical\\demo': createAvailablePath('D:\\canonical\\demo', 'demo'),
      },
    });

    const result = await fixture.application.addWorkspace({
      kind: 'add-workspace',
      scope: createScope({ workspaceId: null }),
      payload: {
        cwd: '  D:\\workspaces\\demo  ',
        name: '',
      },
    });

    assert.deepEqual(fixture.runtimeCommands, []);
    assert.deepEqual(result, createAcceptedWorkspacePanel({
      items: [
        createPanelItem({
          workspaceId: 'D:\\canonical\\demo',
          recordRef: 'workspace-record-1',
          name: 'demo',
          cwd: 'D:\\canonical\\demo',
        }),
      ],
    }));
  });

  test('adds workspace while preserving a non-empty display name exactly', async () => {
    const fixture = createApplicationFixture({
      paths: {
        'D:\\workspaces\\demo': createAvailablePath('D:\\workspaces\\demo', 'demo'),
      },
    });

    const result = await fixture.application.addWorkspace({
      kind: 'add-workspace',
      scope: createScope({ workspaceId: null }),
      payload: {
        cwd: 'D:\\workspaces\\demo',
        name: '  Demo  ',
      },
    });

    assert.deepEqual(result, createAcceptedWorkspacePanel({
      items: [
        createPanelItem({
          workspaceId: 'D:\\workspaces\\demo',
          recordRef: 'workspace-record-1',
          name: '  Demo  ',
          cwd: 'D:\\workspaces\\demo',
        }),
      ],
    }));
  });

  test('renames workspace to an empty display name through the real registry', async () => {
    const fixture = createApplicationFixture({
      registry: createRegistry([
        createRecord({ id: 'workspace-record-1', cwd: 'D:\\workspaces\\demo', name: 'Demo' }),
      ]),
      paths: {
        'D:\\workspaces\\demo': createAvailablePath('D:\\workspaces\\demo', 'demo'),
      },
    });

    const result = await fixture.application.renameWorkspace({
      kind: 'rename-workspace',
      scope: createScope({ workspaceId: null }),
      payload: {
        recordRef: 'workspace-record-1',
        currentWorkspaceId: 'D:\\workspaces\\demo',
        name: '',
      },
    });

    assert.deepEqual(result, createAcceptedWorkspacePanel({
      items: [
        createPanelItem({
          workspaceId: 'D:\\workspaces\\demo',
          recordRef: 'workspace-record-1',
          name: '',
          cwd: 'D:\\workspaces\\demo',
        }),
      ],
    }));
  });

  test('edits workspace cwd while preserving recordRef and name through the real registry', async () => {
    const fixture = createApplicationFixture({
      registry: createRegistry([
        createRecord({ id: 'workspace-record-1', cwd: 'D:\\workspaces\\demo', name: 'Demo Name' }),
      ]),
      paths: {
        'D:\\workspaces\\demo': createAvailablePath('D:\\workspaces\\demo', 'demo'),
        'D:\\workspaces\\renamed': createAvailablePath('D:\\canonical\\renamed', 'renamed'),
        'D:\\canonical\\renamed': createAvailablePath('D:\\canonical\\renamed', 'renamed'),
      },
    });

    const result = await fixture.application.editWorkspaceCwd({
      kind: 'edit-workspace-cwd',
      scope: createScope({ workspaceId: null }),
      payload: {
        recordRef: 'workspace-record-1',
        currentWorkspaceId: 'D:\\workspaces\\demo',
        cwd: '  D:\\workspaces\\renamed  ',
      },
    });

    assert.deepEqual(result, createAcceptedWorkspacePanel({
      items: [
        createPanelItem({
          workspaceId: 'D:\\canonical\\renamed',
          recordRef: 'workspace-record-1',
          name: 'Demo Name',
          cwd: 'D:\\canonical\\renamed',
        }),
      ],
    }));
  });

  test('removes workspace through the real registry', async () => {
    const fixture = createApplicationFixture({
      registry: createRegistry([
        createRecord({ id: 'workspace-record-1', cwd: 'D:\\workspaces\\demo', name: 'Demo' }),
      ]),
      paths: {
        'D:\\workspaces\\demo': createAvailablePath('D:\\workspaces\\demo', 'demo'),
      },
    });

    const result = await fixture.application.removeWorkspace({
      kind: 'remove-workspace',
      scope: createScope({ workspaceId: null }),
      payload: {
        recordRef: 'workspace-record-1',
        currentWorkspaceId: 'D:\\workspaces\\demo',
      },
    });

    assert.deepEqual(result, createAcceptedWorkspacePanel({ items: [] }));
  });

  test('returns rejected action result for real workspace validation errors', async () => {
    const fixture = createApplicationFixture({
      invalidPaths: {
        'D:\\workspaces\\missing': createInvalidPath('missing', '路径不存在'),
      },
    });

    const result = await fixture.application.addWorkspace({
      kind: 'add-workspace',
      scope: createScope({ workspaceId: null }),
      payload: {
        cwd: 'D:\\workspaces\\missing',
        name: 'Missing',
      },
    });

    assert.deepEqual(result, {
      status: 'rejected',
      error: {
        code: 'missing',
        message: '路径不存在',
      },
    });
  });

  test('keeps user mutation in a memory mode panel when persistent write fails', async () => {
    const fixture = createApplicationFixture({
      writeFailure: true,
      paths: {
        'D:\\workspaces\\demo': createAvailablePath('D:\\workspaces\\demo', 'demo'),
      },
    });

    const result = await fixture.application.addWorkspace({
      kind: 'add-workspace',
      scope: createScope({ workspaceId: null }),
      payload: {
        cwd: 'D:\\workspaces\\demo',
        name: 'Demo',
      },
    });

    assert.deepEqual(result, createAcceptedWorkspacePanel({
      persistence: 'memory',
      persistenceError: { code: 'write-failed', message: 'Workspace 配置不可写' },
      items: [
        createPanelItem({
          workspaceId: 'D:\\workspaces\\demo',
          recordRef: 'workspace-record-1',
          name: 'Demo',
          cwd: 'D:\\workspaces\\demo',
        }),
      ],
    }));
  });

  test('workspace registry actions do not send runtime commands', async () => {
    const fixture = createApplicationFixture({
      registry: createRegistry([
        createRecord({ id: 'workspace-record-1', cwd: 'D:\\workspaces\\demo', name: 'Demo' }),
      ]),
      paths: {
        'D:\\workspaces\\demo': createAvailablePath('D:\\workspaces\\demo', 'demo'),
        'D:\\workspaces\\renamed': createAvailablePath('D:\\workspaces\\renamed', 'renamed'),
      },
    });

    await fixture.application.openWorkspacePanel({ kind: 'open-workspace-panel', scope: createScope({ workspaceId: null }), payload: {} });
    await fixture.application.renameWorkspace({ kind: 'rename-workspace', scope: createScope({ workspaceId: null }), payload: { recordRef: 'workspace-record-1', currentWorkspaceId: 'D:\\workspaces\\demo', name: 'Renamed' } });
    await fixture.application.editWorkspaceCwd({ kind: 'edit-workspace-cwd', scope: createScope({ workspaceId: null }), payload: { recordRef: 'workspace-record-1', currentWorkspaceId: 'D:\\workspaces\\demo', cwd: 'D:\\workspaces\\renamed' } });
    await fixture.application.removeWorkspace({ kind: 'remove-workspace', scope: createScope({ workspaceId: null }), payload: { recordRef: 'workspace-record-1', currentWorkspaceId: 'D:\\workspaces\\renamed' } });

    assert.deepEqual(fixture.runtimeCommands, []);
  });
});

interface CreateApplicationFixtureInput {
  readonly registry?: WorkspaceRegistry;
  readonly paths?: Record<string, TestAvailablePath>;
  readonly invalidPaths?: Record<string, TestInvalidPath>;
  readonly writeFailure?: boolean;
}

function createApplicationFixture(input: CreateApplicationFixtureInput = {}) {
  const events: EventBusPort = {
    publish(_event: DomainEvent) {},
    subscribe() {
      return () => {};
    },
  };
  const runtimeFixture = createRuntime();
  const workspace = createWorkspaceService({
    appData: createMemoryAppDataStore(input),
    paths: createTablePathInspection(input.paths ?? {}, input.invalidPaths ?? {}),
    pathComparison: createCaseInsensitivePathComparison(),
    clock: createFixedClock(),
    ids: createSequenceId(),
  });

  return {
    application: createApplication({
      conversation: createConversationService(),
      runtime: runtimeFixture.runtime,
      slot: createSlotService({ events }),
      thread: createThreadService({ events }),
      threadActions: createThreadActionsService(),
      turn: createTurnService(),
      workspace,
    }),
    runtimeCommands: runtimeFixture.calls,
  };
}

function createCaseInsensitivePathComparison(): PathComparisonPort {
  return {
    samePath(input) {
      return input.left.toLowerCase() === input.right.toLowerCase();
    },
  };
}

function createRuntime(results: readonly RuntimeResult[] = []): { readonly calls: RuntimeCommand[]; readonly runtime: RuntimePort } {
  const calls: RuntimeCommand[] = [];
  const pendingResults = [...results];

  return {
    calls,
    runtime: {
      async send(command) {
        calls.push(command);
        const result = pendingResults.shift();
        if (result) {
          return result;
        }

        throw new Error('runtime.send must not be called by workspace registry actions');
      },
      subscribe(_handler: RuntimeEventHandler) {
        return () => {};
      },
      async close() {},
    },
  };
}

function createConversationService(): ConversationService {
  return {
    apply() {
      throw new Error('conversation.apply must not be called by workspace registry actions');
    },
    snapshot() {
      return { revision: 0, items: [] };
    },
  };
}

function createTurnService(): TurnService {
  return {
    apply() {
      throw new Error('turn.apply must not be called by workspace registry actions');
    },
    snapshot() {
      return { current: null };
    },
  };
}

function createThreadActionsService(): ThreadActionsService {
  return {
    async create() {
      throw new Error('threadActions.create must not be called by workspace registry actions');
    },
    async open() {
      throw new Error('threadActions.open must not be called by workspace registry actions');
    },
  };
}

function createFixedClock(): ClockPort {
  return {
    now() {
      return '2026-05-04T00:00:00.000Z';
    },
  };
}

function createSequenceId(): IdPort {
  let nextId = 1;
  return {
    createId() {
      const id = `workspace-record-${nextId}`;
      nextId += 1;
      return id;
    },
  };
}

function createMemoryAppDataStore(input: CreateApplicationFixtureInput): AppDataStorePort {
  let document = input.registry ? JSON.stringify(input.registry) : null;

  return {
    async readDocument() {
      return document;
    },

    async writeDocumentAtomically(writeInput) {
      if (input.writeFailure) {
        throw new AppDataStoreError('write-failed', 'write failed');
      }

      document = writeInput.content;
    },
  };
}

interface TestAvailablePath {
  readonly canonicalPath: string;
  readonly basename: string;
}

interface TestInvalidPath {
  readonly reason: 'empty' | 'relative' | 'missing' | 'not-directory' | 'inaccessible' | 'canonicalization-failed';
  readonly message: string;
}

function createTablePathInspection(paths: Record<string, TestAvailablePath>, invalidPaths: Record<string, TestInvalidPath>): PathInspectionPort {
  return {
    async inspect(input) {
      const available = paths[input.path];
      if (available) {
        return {
          status: 'available',
          canonicalPath: available.canonicalPath,
          basename: available.basename,
        };
      }

      const invalid = invalidPaths[input.path] ?? createInvalidPath('missing', '路径不存在');
      return {
        status: 'invalid',
        reason: invalid.reason,
        message: invalid.message,
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

function createInvalidPath(reason: TestInvalidPath['reason'], message: string): TestInvalidPath {
  return {
    reason,
    message,
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
    createdAt: '2026-05-04T00:00:00.000Z',
  };
}

function createRegistry(workspaces: WorkspaceRegistry['workspaces']): WorkspaceRegistry {
  return {
    version: 1,
    workspaces,
  };
}

interface CreateAcceptedWorkspacePanelInput {
  readonly persistence?: 'persistent' | 'memory';
  readonly persistenceError?: { readonly code: string; readonly message: string } | null;
  readonly selectedWorkspaceId?: string | null;
  readonly items: Extract<ClientWorkspacePanelView, { readonly status: 'ready' }>['list']['items'];
}

function createAcceptedWorkspacePanel(input: CreateAcceptedWorkspacePanelInput): ClientActionResult {
  return {
    status: 'accepted',
    snapshot: null,
    events: [],
    workspacePanel: {
      status: 'ready',
      list: {
        persistence: createExpectedPersistence(input),
        selectedWorkspaceId: input.selectedWorkspaceId ?? null,
        items: input.items,
      },
      page: {
        kind: 'workspace-list',
      },
    },
  };
}

function createExpectedPersistence(input: CreateAcceptedWorkspacePanelInput): ClientWorkspacePersistenceView {
  if (input.persistence === 'memory') {
    return {
      status: 'memory',
      warning: '当前 Workspace 变更不会持久保存',
      error: input.persistenceError ?? { code: 'registry-unreadable', message: 'Workspace 配置不可读' },
    };
  }

  return {
    status: 'persistent',
  };
}

interface CreatePanelItemInput {
  readonly workspaceId: string;
  readonly recordRef: string;
  readonly name: string;
  readonly cwd: string;
  readonly selected?: boolean;
  readonly operations?: readonly ('rename' | 'edit-cwd' | 'remove')[];
}

function createPanelItem(input: CreatePanelItemInput): Extract<ClientWorkspacePanelView, { readonly status: 'ready' }>['list']['items'][number] {
  return {
    workspaceId: input.workspaceId,
    recordRef: input.recordRef,
    name: input.name,
    cwd: input.cwd,
    availability: {
      status: 'available',
    },
    selected: input.selected ?? false,
    operations: input.operations ?? ['rename', 'edit-cwd', 'remove'],
  };
}

interface CreateScopeInput {
  readonly workspaceId: string | null;
}

function createScope(input: CreateScopeInput) {
  return {
    slotId: 'slot-1',
    workspaceId: input.workspaceId,
    threadId: null,
  };
}
