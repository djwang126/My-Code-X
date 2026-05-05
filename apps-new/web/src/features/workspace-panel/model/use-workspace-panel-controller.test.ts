import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type {
  ClientActionResult,
  ClientSnapshot,
  ClientWorkspaceListItemView,
  ClientWorkspacePanelView,
  ClientWorkspaceThreadItemView,
} from '@my-code-x/contracts-new';
import {
  createWorkspacePanelControllerCommands,
  readResumeActionDecision,
} from './use-workspace-panel-controller.js';
import {
  reduceWorkspacePanelState,
  type ReadyWorkspacePanelView,
  type WorkspacePanelState,
} from './workspace-panel-reducer.js';
import { WorkspacePanelApiError, type WorkspacePanelApiBoundary } from '../api/workspace-panel-api.js';
import type { AppScope } from '../../../app/app-scope.js';

describe('workspace panel controller commands', () => {
  test('opens active threads and stores returned active page', async () => {
    const activePage = createActivePage({
      items: [
        createThreadItem({ threadId: 'thread-1', name: 'Thread one', preview: 'Preview one' }),
      ],
    });
    const fixture = createControllerFixture({
      state: createReadyState(),
      api: createApi({
        openActiveThreads: createReadyPanel({
          selectedWorkspaceId: 'D:\\workspaces\\demo',
          items: [
            {
              ...createWorkspaceItem(),
              selected: true,
              operations: ['rename', 'edit-cwd'],
            },
          ],
          page: activePage,
        }),
      }),
    });

    await fixture.commands.openActiveThreads(createWorkspaceItem());

    assert.deepEqual(fixture.state(), createReadyState({
      panel: createReadyPanel({
        selectedWorkspaceId: 'D:\\workspaces\\demo',
        items: [
          {
            ...createWorkspaceItem(),
            selected: true,
            operations: ['rename', 'edit-cwd'],
          },
        ],
        page: activePage,
      }),
    }));
  });

  test('keeps selected workspace visible when opening active threads fails', async () => {
    const fixture = createControllerFixture({
      state: createReadyState(),
      api: createApi({
        openActiveThreadsError: new WorkspacePanelApiError('workspace-unavailable', 'Workspace 不可用'),
      }),
    });

    await fixture.commands.openActiveThreads(createWorkspaceItem());

    assert.deepEqual(fixture.state(), createReadyState({
      panel: createReadyPanel({
        selectedWorkspaceId: 'D:\\workspaces\\demo',
        items: [
          {
            ...createWorkspaceItem(),
            selected: true,
            operations: ['rename', 'edit-cwd'],
          },
        ],
        page: createActivePage({
          resource: {
            status: 'failed',
            error: {
              code: 'workspace-unavailable',
              message: 'Workspace 不可用',
            },
          },
        }),
      }),
    }));
  });

  test('loads more active threads with the current cursor', async () => {
    const fixture = createControllerFixture({
      state: createReadyState({
        panel: createReadyPanel({ page: createActivePage() }),
      }),
      api: createApi({
        loadMoreActiveThreads: createReadyPanel({
          page: createActivePage({
            items: [
              createThreadItem({ threadId: 'thread-3', name: 'Third', preview: 'Third preview' }),
            ],
            nextCursor: null,
          }),
        }),
      }),
    });

    await fixture.commands.loadMoreActiveThreads();

    assert.deepEqual(fixture.apiCalls(), [
      {
        kind: 'load-more',
        workspaceId: 'D:\\workspaces\\demo',
        cursor: 'next-1',
      },
    ]);
    assert.deepEqual(fixture.state(), createReadyState({
      panel: createReadyPanel({
        page: createActivePage({
          items: [
            createThreadItem({ threadId: 'thread-1', name: 'Current', preview: 'Current preview', current: true }),
            createThreadItem({ threadId: 'thread-2', name: 'Second', preview: 'Second preview' }),
            createThreadItem({ threadId: 'thread-3', name: 'Third', preview: 'Third preview' }),
          ],
          nextCursor: null,
        }),
      }),
    }));
  });

  test('refreshes the workspace list from the returned panel after load more succeeds', async () => {
    const currentWorkspace = createWorkspaceItem({
      selected: true,
      operations: ['rename', 'edit-cwd'],
    });
    const otherWorkspace = createWorkspaceItem({
      workspaceId: 'D:\\workspaces\\other',
      recordRef: 'workspace-record-other',
      name: 'Other',
    });
    const refreshedOtherWorkspace = {
      ...otherWorkspace,
      name: 'Other updated',
    };
    const fixture = createControllerFixture({
      state: createReadyState({
        panel: createReadyPanel({
          selectedWorkspaceId: 'D:\\workspaces\\demo',
          items: [currentWorkspace, otherWorkspace],
          page: createActivePage(),
        }),
      }),
      api: createApi({
        loadMoreActiveThreads: createReadyPanel({
          selectedWorkspaceId: 'D:\\workspaces\\demo',
          items: [currentWorkspace, refreshedOtherWorkspace],
          page: createActivePage({
            items: [
              createThreadItem({ threadId: 'thread-3', name: 'Third', preview: 'Third preview' }),
            ],
            nextCursor: null,
          }),
        }),
      }),
    });

    await fixture.commands.loadMoreActiveThreads();

    assert.deepEqual(fixture.state(), createReadyState({
      panel: createReadyPanel({
        selectedWorkspaceId: 'D:\\workspaces\\demo',
        items: [currentWorkspace, refreshedOtherWorkspace],
        page: createActivePage({
          items: [
            createThreadItem({ threadId: 'thread-1', name: 'Current', preview: 'Current preview', current: true }),
            createThreadItem({ threadId: 'thread-2', name: 'Second', preview: 'Second preview' }),
            createThreadItem({ threadId: 'thread-3', name: 'Third', preview: 'Third preview' }),
          ],
          nextCursor: null,
        }),
      }),
    }));
  });

  test('keeps active cards and cursor when load more fails', async () => {
    const fixture = createControllerFixture({
      state: createReadyState({
        panel: createReadyPanel({ page: createActivePage() }),
      }),
      api: createApi({
        loadMoreActiveThreadsError: new WorkspacePanelApiError('thread-list-failed', '加载更多失败'),
      }),
    });

    await fixture.commands.loadMoreActiveThreads();

    assert.deepEqual(fixture.state(), createReadyState({
      panel: createReadyPanel({
        page: createActivePage({
          loadMore: {
            status: 'failed',
            error: {
              code: 'thread-list-failed',
              message: '加载更多失败',
            },
          },
        }),
      }),
    }));
  });

  test('applies resume snapshot and closes panel when resume succeeds', async () => {
    const snapshot = createSnapshot({ threadId: 'thread-2' });
    const acceptedSnapshots: ClientSnapshot[] = [];
    const fixture = createControllerFixture({
      state: createReadyState({
        panel: createReadyPanel({ page: createActivePage() }),
      }),
      api: createApi({
        resumeThread: {
          status: 'accepted',
          snapshot,
          events: [],
          workspacePanel: null,
        },
      }),
      onResumeAccepted(nextSnapshot) {
        acceptedSnapshots.push(nextSnapshot);
      },
    });

    await fixture.commands.resumeThread({ threadId: 'thread-2', current: false });

    assert.deepEqual(acceptedSnapshots, [snapshot]);
    assert.deepEqual(fixture.state(), { status: 'closed' });
  });

  test('shows card-scoped error when resume is rejected', async () => {
    const fixture = createControllerFixture({
      state: createReadyState({
        panel: createReadyPanel({ page: createActivePage() }),
      }),
      api: createApi({
        resumeThread: {
          status: 'rejected',
          error: {
            code: 'thread-resume-failed',
            message: 'Thread 恢复失败',
          },
        },
      }),
    });

    await fixture.commands.resumeThread({ threadId: 'thread-2', current: false });

    assert.deepEqual(fixture.state(), createReadyState({
      panel: createReadyPanel({
        page: createActivePage({
          secondThreadError: {
            code: 'thread-resume-failed',
            message: 'Thread 恢复失败',
          },
        }),
      }),
    }));
  });

  test('shows card-scoped error when accepted resume lacks snapshot', async () => {
    const fixture = createControllerFixture({
      state: createReadyState({
        panel: createReadyPanel({ page: createActivePage() }),
      }),
      api: createApi({
        resumeThread: {
          status: 'accepted',
          snapshot: null,
          events: [],
          workspacePanel: null,
        },
      }),
    });

    await fixture.commands.resumeThread({ threadId: 'thread-2', current: false });

    assert.deepEqual(fixture.state(), createReadyState({
      panel: createReadyPanel({
        page: createActivePage({
          secondThreadError: {
            code: 'thread-resume-failed',
            message: 'Thread 恢复没有返回会话快照',
          },
        }),
      }),
    }));
  });
});

describe('readResumeActionDecision', () => {
  test('treats an accepted resume without a snapshot as a card-scoped failure', () => {
    const decision = readResumeActionDecision({
      status: 'accepted',
      snapshot: null,
      events: [],
      workspacePanel: null,
    });

    assert.deepEqual(decision, {
      status: 'failed',
      message: 'Thread 恢复没有返回会话快照',
    });
  });

  test('keeps the accepted resume snapshot for the caller to apply before closing the panel', () => {
    const snapshot = createSnapshot({ threadId: 'thread-1' });
    const decision = readResumeActionDecision({
      status: 'accepted',
      snapshot,
      events: [],
      workspacePanel: null,
    });

    assert.deepEqual(decision, {
      status: 'ready',
      snapshot,
    });
  });

  test('preserves rejected resume messages for card-scoped display', () => {
    const result: ClientActionResult = {
      status: 'rejected',
      error: {
        code: 'thread-resume-failed',
        message: 'Thread 恢复失败',
      },
    };

    assert.deepEqual(readResumeActionDecision(result), {
      status: 'failed',
      message: 'Thread 恢复失败',
    });
  });
});

interface CreateControllerFixtureInput {
  readonly state: WorkspacePanelState;
  readonly api: WorkspacePanelApiBoundary;
  onResumeAccepted?(snapshot: ClientSnapshot): void;
}

function createControllerFixture(input: CreateControllerFixtureInput) {
  let state = input.state;
  const commands = createWorkspacePanelControllerCommands({
    scope: createScope(),
    api: input.api,
    readState() {
      return state;
    },
    dispatch(action) {
      state = reduceWorkspacePanelState(state, action);
    },
    onResumeAccepted: input.onResumeAccepted,
  });

  return {
    commands,
    state() {
      return state;
    },
    apiCalls() {
      const api = input.api as TestWorkspacePanelApiBoundary;
      return api.calls;
    },
  };
}

interface TestWorkspacePanelApiBoundary extends WorkspacePanelApiBoundary {
  readonly calls: readonly unknown[];
}

interface CreateApiInput {
  readonly openActiveThreads?: ClientWorkspacePanelView;
  readonly openActiveThreadsError?: Error;
  readonly loadMoreActiveThreads?: ClientWorkspacePanelView;
  readonly loadMoreActiveThreadsError?: Error;
  readonly resumeThread?: ClientActionResult;
}

function createApi(input: CreateApiInput): TestWorkspacePanelApiBoundary {
  const calls: unknown[] = [];
  return {
    calls,
    async open() {
      throw new Error('open is outside this test');
    },
    async add() {
      throw new Error('add is outside this test');
    },
    async rename() {
      throw new Error('rename is outside this test');
    },
    async editCwd() {
      throw new Error('editCwd is outside this test');
    },
    async remove() {
      throw new Error('remove is outside this test');
    },
    async openActiveThreads(openInput) {
      calls.push({
        kind: 'open-active',
        workspaceId: openInput.workspaceId,
      });
      if (input.openActiveThreadsError) {
        throw input.openActiveThreadsError;
      }

      return input.openActiveThreads ?? createReadyPanel();
    },
    async loadMoreActiveThreads(loadInput) {
      calls.push({
        kind: 'load-more',
        workspaceId: loadInput.workspaceId,
        cursor: loadInput.cursor,
      });
      if (input.loadMoreActiveThreadsError) {
        throw input.loadMoreActiveThreadsError;
      }

      return input.loadMoreActiveThreads ?? createReadyPanel();
    },
    async resumeThread(resumeInput) {
      calls.push({
        kind: 'resume',
        workspaceId: resumeInput.workspaceId,
        threadId: resumeInput.threadId,
      });
      return input.resumeThread ?? {
        status: 'rejected',
        error: {
          code: 'thread-resume-failed',
          message: 'Thread 恢复失败',
        },
      };
    },
  };
}

function createReadyState(input: { readonly panel?: ReadyWorkspacePanelView } = {}): WorkspacePanelState {
  return {
    status: 'ready',
    panel: input.panel ?? createReadyPanel(),
    modal: {
      status: 'none',
    },
    listError: null,
  };
}

function createReadyPanel(input: {
  readonly selectedWorkspaceId?: string | null;
  readonly items?: readonly ClientWorkspaceListItemView[];
  readonly page?: ReadyWorkspacePanelView['page'];
} = {}): ReadyWorkspacePanelView {
  return {
    status: 'ready',
    list: {
      persistence: {
        status: 'persistent',
      },
      selectedWorkspaceId: input.selectedWorkspaceId ?? null,
      items: input.items ?? [createWorkspaceItem()],
    },
    page: input.page ?? {
      kind: 'workspace-list',
    },
  };
}

function createActivePage(input: {
  readonly items?: readonly ClientWorkspaceThreadItemView[];
  readonly nextCursor?: string | null;
  readonly loadMore?: Extract<Extract<ReadyWorkspacePanelView['page'], { readonly kind: 'active-threads' }>['resource'], { readonly status: 'ready' }>['loadMore'];
  readonly secondThreadError?: { readonly code: string; readonly message: string } | null;
  readonly resource?: Extract<ReadyWorkspacePanelView['page'], { readonly kind: 'active-threads' }>['resource'];
} = {}): Extract<ReadyWorkspacePanelView['page'], { readonly kind: 'active-threads' }> {
  return {
    kind: 'active-threads',
    workspaceId: 'D:\\workspaces\\demo',
    name: 'Demo',
    cwd: 'D:\\workspaces\\demo',
    resource: input.resource ?? {
      status: 'ready',
      items: input.items ?? [
        createThreadItem({ threadId: 'thread-1', name: 'Current', preview: 'Current preview', current: true }),
        createThreadItem({
          threadId: 'thread-2',
          name: 'Second',
          preview: 'Second preview',
          cardError: input.secondThreadError ?? null,
        }),
      ],
      nextCursor: input.nextCursor === undefined ? 'next-1' : input.nextCursor,
      loadMore: input.loadMore ?? {
        status: 'idle',
      },
    },
  };
}

function createWorkspaceItem(input: {
  readonly workspaceId?: string;
  readonly recordRef?: string;
  readonly name?: string;
  readonly selected?: boolean;
  readonly operations?: readonly ClientWorkspaceListItemView['operations'][number][];
} = {}): ClientWorkspaceListItemView {
  const workspaceId = input.workspaceId ?? 'D:\\workspaces\\demo';

  return {
    workspaceId,
    recordRef: input.recordRef ?? 'workspace-record-1',
    name: input.name ?? 'Demo',
    cwd: workspaceId,
    availability: {
      status: 'available',
    },
    selected: input.selected ?? false,
    operations: input.operations ?? ['rename', 'edit-cwd', 'remove'],
  };
}

function createThreadItem(input: {
  readonly threadId: string;
  readonly name: string;
  readonly preview: string;
  readonly current?: boolean;
  readonly cardError?: { readonly code: string; readonly message: string } | null;
}): ClientWorkspaceThreadItemView {
  return {
    threadId: input.threadId,
    name: input.name,
    preview: input.preview,
    updatedAtIso: null,
    current: input.current ?? false,
    cardError: input.cardError ?? null,
    operation: 'idle',
  };
}

function createScope(): AppScope {
  return {
    slotId: 'slot-1',
    workspaceId: null,
    threadId: 'thread-1',
    label: 'thread thread-1',
  };
}

function createSnapshot(input: { readonly threadId: string }): ClientSnapshot {
  return {
    app: {
      status: 'ready',
    },
    identity: {
      slotId: 'slot-1',
    },
    selection: {
      workspaceId: 'D:\\workspaces\\demo',
      threadId: input.threadId,
    },
    workspace: {
      status: 'selected',
    },
    thread: {
      status: 'ready',
      title: 'Demo thread',
    },
    turn: {
      current: null,
    },
    conversation: {
      status: 'ready',
      revision: 1,
      items: [],
    },
    pendingInteractions: [],
    notices: [],
    capabilities: {
      actions: [],
      options: {},
    },
    stream: {
      status: 'disabled',
      revision: 'resume-thread',
    },
  };
}
