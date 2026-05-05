import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createApplication } from './create-application.js';
import type { ClientActionResult } from '@my-code-x/contracts-new';
import { createConversationService } from '../features/conversation/index.js';
import { createSlotService } from '../features/slot/index.js';
import { createThreadActionsService } from '../features/thread-actions/index.js';
import { createThreadService } from '../features/thread/index.js';
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
  RuntimeThreadItem,
} from '../ports/index.js';

describe('resumeClientThread workspace active thread behavior', () => {
  test('resumes a saved available workspace thread and returns an updated client snapshot', async () => {
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
          kind: 'thread-resumed',
          threadId: 'thread-2',
          snapshot: {
            threadId: 'thread-2',
            name: 'Second thread',
            items: [
              createRuntimeUserMessage({ itemId: 'user-1', text: 'restored hello' }),
              createRuntimeAgentMessage({ itemId: 'assistant-1', text: 'restored answer' }),
            ],
            pendingInputs: [],
          },
        },
      ],
    });

    const result = await fixture.application.resumeClientThread({
      kind: 'resume-thread',
      scope: createScope({
        workspaceId: 'D:\\workspaces\\demo',
        threadId: 'thread-2',
      }),
      payload: {},
    });

    const resumeCommand = readOnlyResumeThreadCommand(fixture.runtimeCommands);
    assert.equal(resumeCommand.threadId, 'thread-2');
    assert.equal(resumeCommand.workspace, 'D:\\workspaces\\demo');
    const accepted = readAcceptedResult(result);
    assert.equal(accepted.workspacePanel, null);
    assert.deepEqual(accepted.snapshot?.selection, {
      workspaceId: 'D:\\workspaces\\demo',
      threadId: 'thread-2',
    });
    assert.deepEqual(accepted.snapshot?.conversation, {
      status: 'ready',
      revision: 1,
      items: [
        {
          id: 'user-1',
          kind: 'message',
          role: 'user',
          text: 'restored hello',
        },
        {
          id: 'assistant-1',
          kind: 'message',
          role: 'assistant',
          text: 'restored answer',
        },
      ],
    });
  });

  test('rejects resume for an unsaved workspace without calling runtime resume', async () => {
    const fixture = createApplicationFixture({
      registry: createRegistry([]),
      paths: {},
    });

    const result = await fixture.application.resumeClientThread({
      kind: 'resume-thread',
      scope: createScope({
        workspaceId: 'D:\\workspaces\\unknown',
        threadId: 'thread-2',
      }),
      payload: {},
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

  test('rejects resume for an unavailable saved workspace without calling runtime resume', async () => {
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

    const result = await fixture.application.resumeClientThread({
      kind: 'resume-thread',
      scope: createScope({
        workspaceId: 'D:\\workspaces\\demo',
        threadId: 'thread-2',
      }),
      payload: {},
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

  test('rejects resume when the runtime does not resume the thread', async () => {
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

    const result = await fixture.application.resumeClientThread({
      kind: 'resume-thread',
      scope: createScope({
        workspaceId: 'D:\\workspaces\\demo',
        threadId: 'thread-2',
      }),
      payload: {},
    });

    assert.deepEqual(result, {
      status: 'rejected',
      error: {
        code: 'thread-resume-failed',
        message: 'Thread 恢复失败',
      },
    });
  });

  test('rejects resume when slotId is missing', async () => {
    const fixture = createApplicationFixture({
      registry: createRegistry([]),
      paths: {},
    });

    const result = await fixture.application.resumeClientThread(
      createResumeAction({ slotId: null, workspaceId: 'D:\\workspaces\\demo', threadId: 'thread-2' }),
    );

    assertInvalidScopeResult(result);
  });

  test('rejects resume when workspaceId is missing', async () => {
    const fixture = createApplicationFixture({
      registry: createRegistry([]),
      paths: {},
    });

    const result = await fixture.application.resumeClientThread(
      createResumeAction({ slotId: 'slot-1', workspaceId: null, threadId: 'thread-2' }),
    );

    assertInvalidScopeResult(result);
  });

  test('rejects resume when threadId is missing', async () => {
    const fixture = createApplicationFixture({
      registry: createRegistry([]),
      paths: {},
    });

    const result = await fixture.application.resumeClientThread(
      createResumeAction({ slotId: 'slot-1', workspaceId: 'D:\\workspaces\\demo', threadId: null }),
    );

    assertInvalidScopeResult(result);
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

function createEventBus(): EventBusPort {
  return {
    publish(_event: DomainEvent) {},
    subscribe() {
      return () => {};
    },
  };
}

function readAcceptedResult(result: ClientActionResult): Extract<ClientActionResult, { readonly status: 'accepted' }> {
  assert.equal(result.status, 'accepted');
  return result as Extract<ClientActionResult, { readonly status: 'accepted' }>;
}

function readOnlyResumeThreadCommand(commands: readonly RuntimeCommand[]) {
  assert.deepEqual(commands.map(command => command.kind), ['resume-thread']);
  const command = commands[0];
  assert.equal(command?.kind, 'resume-thread');
  return command as Extract<RuntimeCommand, { readonly kind: 'resume-thread' }>;
}

function assertInvalidScopeResult(result: ClientActionResult): void {
  assert.deepEqual(result, {
    status: 'rejected',
    error: {
      code: 'invalid-scope',
      message: 'Thread 恢复缺少必要 scope',
    },
  });
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
      throw new Error('resume tests do not mutate registry');
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

interface CreateResumeActionInput {
  readonly slotId: string | null;
  readonly workspaceId: string | null;
  readonly threadId: string | null;
}

function createResumeAction(input: CreateResumeActionInput) {
  return {
    kind: 'resume-thread' as const,
    scope: {
      slotId: input.slotId,
      workspaceId: input.workspaceId,
      threadId: input.threadId,
    },
    payload: {},
  };
}

interface CreateRuntimeMessageInput {
  readonly itemId: string;
  readonly text: string | null;
}

function createRuntimeUserMessage(input: CreateRuntimeMessageInput): RuntimeThreadItem {
  return {
    itemId: input.itemId,
    itemKind: 'userMessage',
    status: null,
    text: input.text,
    content: [],
  };
}

function createRuntimeAgentMessage(input: CreateRuntimeMessageInput): RuntimeThreadItem {
  return {
    itemId: input.itemId,
    itemKind: 'agentMessage',
    status: null,
    text: input.text,
    phase: null,
    memoryCitation: null,
  };
}

