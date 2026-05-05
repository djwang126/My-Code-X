import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { ClientWorkspaceListItemView, ClientWorkspacePanelPageView, ClientWorkspaceThreadItemView } from '@my-code-x/contracts-new';

import {
  createInitialWorkspacePanelState,
  reduceWorkspacePanelState,
  type ReadyWorkspacePanelView,
} from './workspace-panel-reducer.js';

describe('workspace panel reducer', () => {
  test('starts loading when panel opens', () => {
    const state = reduceWorkspacePanelState(createInitialWorkspacePanelState(), {
      kind: 'open-started',
    });

    assert.deepEqual(state, {
      status: 'loading',
    });
  });

  test('stores ready list after load succeeds', () => {
    const state = reduceWorkspacePanelState({ status: 'loading' }, {
      kind: 'open-succeeded',
      panel: createReadyPanel(),
    });

    assert.deepEqual(state, {
      status: 'ready',
      panel: createReadyPanel(),
      modal: {
        status: 'none',
      },
      listError: null,
    });
  });

  test('stores failed state after load fails', () => {
    const state = reduceWorkspacePanelState({ status: 'loading' }, {
      kind: 'open-failed',
      message: 'Workspace 列表加载失败',
    });

    assert.deepEqual(state, {
      status: 'failed',
      message: 'Workspace 列表加载失败',
    });
  });

  test('opens add modal from ready state', () => {
    const readyState = createReadyState();

    assert.deepEqual(reduceWorkspacePanelState(readyState, { kind: 'open-add-modal' }), {
      status: 'ready',
      panel: createReadyPanel(),
      modal: {
        status: 'add',
        submit: {
          status: 'idle',
          error: null,
        },
      },
      listError: null,
    });
  });

  test('opens rename modal with selected item from ready state', () => {
    const readyState = createReadyState();
    const item = createReadyPanel().list.items[0]!;

    assert.deepEqual(reduceWorkspacePanelState(readyState, { kind: 'open-rename-modal', item }), {
      status: 'ready',
      panel: createReadyPanel(),
      modal: {
        status: 'rename',
        item,
        submit: {
          status: 'idle',
          error: null,
        },
      },
      listError: null,
    });
  });

  test('opens edit cwd modal with selected item from ready state', () => {
    const readyState = createReadyState();
    const item = createReadyPanel().list.items[0]!;

    assert.deepEqual(reduceWorkspacePanelState(readyState, { kind: 'open-edit-cwd-modal', item }), {
      status: 'ready',
      panel: createReadyPanel(),
      modal: {
        status: 'edit-cwd',
        item,
        submit: {
          status: 'idle',
          error: null,
        },
      },
      listError: null,
    });
  });

  test('keeps modal open and locked while submit is pending', () => {
    const submitting = reduceWorkspacePanelState({
      status: 'ready',
      panel: createReadyPanel(),
      modal: {
        status: 'add',
        submit: {
          status: 'idle',
          error: null,
        },
      },
      listError: null,
    }, {
      kind: 'submit-started',
    });
    const closed = reduceWorkspacePanelState(submitting, {
      kind: 'close-requested',
    });

    assert.deepEqual(closed, {
      status: 'ready',
      panel: createReadyPanel(),
      modal: {
        status: 'add',
        submit: {
          status: 'submitting',
        },
      },
      listError: null,
    });
  });

  test('applies updated list after submit succeeds and closes modal', () => {
    const updatedPanel = createReadyPanel({ persistence: 'memory', items: [] });

    const state = reduceWorkspacePanelState({
      status: 'ready',
      panel: createReadyPanel(),
      modal: {
        status: 'add',
        submit: {
          status: 'submitting',
        },
      },
      listError: null,
    }, {
      kind: 'submit-succeeded',
      panel: updatedPanel,
    });

    assert.deepEqual(state, {
      status: 'ready',
      panel: updatedPanel,
      modal: {
        status: 'none',
      },
      listError: null,
    });
  });

  test('keeps modal open with error after submit fails', () => {
    const state = reduceWorkspacePanelState({
      status: 'ready',
      panel: createReadyPanel(),
      modal: {
        status: 'rename',
        item: createReadyPanel().list.items[0]!,
        submit: {
          status: 'submitting',
        },
      },
      listError: null,
    }, {
      kind: 'submit-failed',
      message: '路径不存在',
    });

    assert.deepEqual(state, {
      status: 'ready',
      panel: createReadyPanel(),
      modal: {
        status: 'rename',
        item: createReadyPanel().list.items[0]!,
        submit: {
          status: 'idle',
          error: '路径不存在',
        },
      },
      listError: null,
    });
  });

  test('keeps ready list visible when list action fails', () => {
    const state = reduceWorkspacePanelState(createReadyState(), {
      kind: 'list-action-failed',
      message: '移除失败',
    });

    assert.deepEqual(state, {
      status: 'ready',
      panel: createReadyPanel(),
      modal: {
        status: 'none',
      },
      listError: '移除失败',
    });
  });

  test('switches from active threads page back to workspace list locally', () => {
    const state = reduceWorkspacePanelState(createReadyState({
      panel: createReadyPanel({ page: createActivePage() }),
    }), {
      kind: 'show-workspace-list',
    });

    assert.deepEqual(state, createReadyState({
      panel: createReadyPanel({
        page: {
          kind: 'workspace-list',
        },
      }),
    }));
  });

  test('stores active first page after available workspace opens', () => {
    const activePage = createActivePage();
    const state = reduceWorkspacePanelState(createReadyState(), {
      kind: 'active-open-succeeded',
      panel: createReadyPanel({ page: activePage }),
    });

    assert.deepEqual(state, createReadyState({
      panel: createReadyPanel({ page: activePage }),
    }));
  });

  test('replaces list with server-authoritative list after active workspace opens', () => {
    const workspaceA = createWorkspaceItem({
      workspaceId: 'D:\\workspaces\\a',
      recordRef: 'workspace-record-a',
      name: 'A',
      selected: true,
      operations: ['rename', 'edit-cwd'],
    });
    const workspaceB = createWorkspaceItem({
      workspaceId: 'D:\\workspaces\\b',
      recordRef: 'workspace-record-b',
      name: 'B',
    });
    const serverPanel = createReadyPanel({
      selectedWorkspaceId: 'D:\\workspaces\\b',
      items: [
        {
          ...workspaceA,
          selected: false,
          operations: ['rename', 'edit-cwd', 'remove'],
        },
        {
          ...workspaceB,
          selected: true,
          operations: ['rename', 'edit-cwd'],
        },
      ],
      page: createActivePage({
        workspaceId: 'D:\\workspaces\\b',
        name: 'B',
        cwd: 'D:\\workspaces\\b',
      }),
    });

    const state = reduceWorkspacePanelState(createReadyState({
      panel: createReadyPanel({
        selectedWorkspaceId: 'D:\\workspaces\\a',
        items: [workspaceA, workspaceB],
      }),
    }), {
      kind: 'active-open-succeeded',
      panel: serverPanel,
    });

    assert.deepEqual(state, createReadyState({ panel: serverPanel }));
  });

  test('stores loading active page when an available workspace is opened', () => {
    const item = createReadyPanel().list.items[0]!;
    const state = reduceWorkspacePanelState(createReadyState(), {
      kind: 'active-open-started',
      item,
    });

    assert.deepEqual(state, createReadyState({
      panel: createReadyPanel({
        selectedWorkspaceId: 'D:\\workspaces\\demo',
        items: [
          {
            ...item,
            selected: true,
            operations: ['rename', 'edit-cwd'],
          },
        ],
        page: {
          kind: 'active-threads',
          workspaceId: 'D:\\workspaces\\demo',
          name: 'Demo',
          cwd: 'D:\\workspaces\\demo',
          resource: {
            status: 'loading',
          },
        },
      }),
    }));
  });

  test('optimistic active open restores remove operation on the previously selected workspace', () => {
    const workspaceA = createWorkspaceItem({
      workspaceId: 'D:\\workspaces\\a',
      recordRef: 'workspace-record-a',
      name: 'A',
      selected: true,
      operations: ['rename', 'edit-cwd'],
    });
    const workspaceB = createWorkspaceItem({
      workspaceId: 'D:\\workspaces\\b',
      recordRef: 'workspace-record-b',
      name: 'B',
    });

    const state = reduceWorkspacePanelState(createReadyState({
      panel: createReadyPanel({
        selectedWorkspaceId: 'D:\\workspaces\\a',
        items: [workspaceA, workspaceB],
      }),
    }), {
      kind: 'active-open-started',
      item: workspaceB,
    });

    assert.deepEqual(state, createReadyState({
      panel: createReadyPanel({
        selectedWorkspaceId: 'D:\\workspaces\\b',
        items: [
          {
            ...workspaceA,
            selected: false,
            operations: ['rename', 'edit-cwd', 'remove'],
          },
          {
            ...workspaceB,
            selected: true,
            operations: ['rename', 'edit-cwd'],
          },
        ],
        page: {
          kind: 'active-threads',
          workspaceId: 'D:\\workspaces\\b',
          name: 'B',
          cwd: 'D:\\workspaces\\b',
          resource: {
            status: 'loading',
          },
        },
      }),
    }));
  });

  test('stores active first page failure without hiding the workspace selection', () => {
    const loading = reduceWorkspacePanelState(createReadyState(), {
      kind: 'active-open-started',
      item: createReadyPanel().list.items[0]!,
    });
    const state = reduceWorkspacePanelState(loading, {
      kind: 'active-open-failed',
      error: {
        code: 'workspace-unavailable',
        message: 'Workspace 不可用',
      },
    });

    assert.deepEqual(state, createReadyState({
      panel: createReadyPanel({
        selectedWorkspaceId: 'D:\\workspaces\\demo',
        items: [
          {
            ...createReadyPanel().list.items[0]!,
            selected: true,
            operations: ['rename', 'edit-cwd'],
          },
        ],
        page: {
          kind: 'active-threads',
          workspaceId: 'D:\\workspaces\\demo',
          name: 'Demo',
          cwd: 'D:\\workspaces\\demo',
          resource: {
            status: 'failed',
            error: {
              code: 'workspace-unavailable',
              message: 'Workspace 不可用',
            },
          },
        },
      }),
    }));
  });

  test('marks load more as loading without dropping active thread items or cursor', () => {
    const state = reduceWorkspacePanelState(createReadyState({
      panel: createReadyPanel({ page: createActivePage() }),
    }), {
      kind: 'active-load-more-started',
    });

    assert.deepEqual(state, createReadyState({
      panel: createReadyPanel({
        page: createActivePage({
          loadMore: {
            status: 'loading',
          },
        }),
      }),
    }));
  });

  test('appends loaded active threads without reordering existing cards', () => {
    const state = reduceWorkspacePanelState(createReadyState({
      panel: createReadyPanel({ page: createActivePage() }),
    }), {
      kind: 'active-load-more-succeeded',
      panel: createReadyPanel({
        page: createActivePage({
          items: [
            createThreadItem({ threadId: 'thread-3', name: 'Third', preview: 'Third preview' }),
            createThreadItem({ threadId: 'thread-4', name: 'Fourth', preview: 'Fourth preview' }),
          ],
          nextCursor: null,
        }),
      }),
    });

    assert.deepEqual(state, createReadyState({
      panel: createReadyPanel({
        page: createActivePage({
          items: [
            createThreadItem({ threadId: 'thread-1', name: 'Current', preview: 'Current preview', current: true }),
            createThreadItem({ threadId: 'thread-2', name: 'Second', preview: 'Second preview' }),
            createThreadItem({ threadId: 'thread-3', name: 'Third', preview: 'Third preview' }),
            createThreadItem({ threadId: 'thread-4', name: 'Fourth', preview: 'Fourth preview' }),
          ],
          nextCursor: null,
        }),
      }),
    }));
  });

  test('load more appends threads while refreshing list from server panel', () => {
    const workspaceA = createWorkspaceItem({
      workspaceId: 'D:\\workspaces\\a',
      recordRef: 'workspace-record-a',
      name: 'A',
      selected: true,
      operations: ['rename', 'edit-cwd'],
    });
    const workspaceB = createWorkspaceItem({
      workspaceId: 'D:\\workspaces\\b',
      recordRef: 'workspace-record-b',
      name: 'B',
    });
    const refreshedItems = [
      workspaceA,
      {
        ...workspaceB,
        name: 'B updated',
      },
    ];
    const state = reduceWorkspacePanelState(createReadyState({
      panel: createReadyPanel({
        selectedWorkspaceId: 'D:\\workspaces\\a',
        items: [workspaceA, workspaceB],
        page: createActivePage(),
      }),
    }), {
      kind: 'active-load-more-succeeded',
      panel: createReadyPanel({
        selectedWorkspaceId: 'D:\\workspaces\\a',
        items: refreshedItems,
        page: createActivePage({
          items: [
            createThreadItem({ threadId: 'thread-3', name: 'Third', preview: 'Third preview' }),
          ],
          nextCursor: null,
        }),
      }),
    });

    assert.deepEqual(state, createReadyState({
      panel: createReadyPanel({
        selectedWorkspaceId: 'D:\\workspaces\\a',
        items: refreshedItems,
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

  test('keeps active threads and cursor when load more fails', () => {
    const state = reduceWorkspacePanelState(createReadyState({
      panel: createReadyPanel({ page: createActivePage() }),
    }), {
      kind: 'active-load-more-failed',
      error: {
        code: 'workspace-unavailable',
        message: 'Workspace 不可用',
      },
    });

    assert.deepEqual(state, createReadyState({
      panel: createReadyPanel({
        page: createActivePage({
          loadMore: {
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

  test('retries load more with the same cursor after a load more failure', () => {
    const failed = createReadyState({
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
    });
    const state = reduceWorkspacePanelState(failed, {
      kind: 'active-load-more-started',
    });

    assert.deepEqual(state, createReadyState({
      panel: createReadyPanel({
        page: createActivePage({
          loadMore: {
            status: 'loading',
          },
        }),
      }),
    }));
  });

  test('marks only the requested active thread card as resuming', () => {
    const state = reduceWorkspacePanelState(createReadyState({
      panel: createReadyPanel({ page: createActivePage() }),
    }), {
      kind: 'active-resume-started',
      threadId: 'thread-2',
    });

    assert.deepEqual(state, createReadyState({
      panel: createReadyPanel({
        page: createActivePage({
          items: [
            createThreadItem({ threadId: 'thread-1', name: 'Current', preview: 'Current preview', current: true }),
            createThreadItem({ threadId: 'thread-2', name: 'Second', preview: 'Second preview', operation: 'resuming' }),
          ],
        }),
      }),
    }));
  });

  test('marks a single active thread card with resume error', () => {
    const state = reduceWorkspacePanelState(createReadyState({
      panel: createReadyPanel({ page: createActivePage() }),
    }), {
      kind: 'active-resume-failed',
      threadId: 'thread-2',
      message: 'resume failed',
    });

    assert.deepEqual(state, createReadyState({
      panel: createReadyPanel({
        page: createActivePage({
          secondThreadError: {
            code: 'thread-resume-failed',
            message: 'resume failed',
          },
        }),
      }),
    }));
  });
});

interface CreateReadyStateInput {
  readonly panel?: ReadyWorkspacePanelView;
}

function createReadyState(input: CreateReadyStateInput = {}) {
  return {
    status: 'ready' as const,
    panel: input.panel ?? createReadyPanel(),
    modal: {
      status: 'none' as const,
    },
    listError: null,
  };
}

interface CreateReadyPanelInput {
  readonly persistence?: 'persistent' | 'memory';
  readonly items?: readonly ClientWorkspaceListItemView[];
  readonly selectedWorkspaceId?: string | null;
  readonly page?: ClientWorkspacePanelPageView;
}

function createReadyPanel(input: CreateReadyPanelInput = {}): ReadyWorkspacePanelView {
  return {
    status: 'ready' as const,
    list: {
      persistence: input.persistence === 'memory'
        ? {
            status: 'memory' as const,
            warning: '当前 Workspace 变更不会持久保存',
            error: { code: 'registry-unreadable', message: 'Workspace 配置不可读' },
          }
        : { status: 'persistent' as const },
      selectedWorkspaceId: input.selectedWorkspaceId ?? null,
      items: input.items ?? [createWorkspaceItem()],
    },
    page: {
      kind: 'workspace-list',
    },
    ...(input.page === undefined ? {} : { page: input.page }),
  };
}

function createActivePage(input: CreateActivePageInput = {}): ClientWorkspacePanelPageView {
  return {
    kind: 'active-threads',
    workspaceId: input.workspaceId ?? 'D:\\workspaces\\demo',
    name: input.name ?? 'Demo',
    cwd: input.cwd ?? 'D:\\workspaces\\demo',
    resource: {
      status: 'ready',
      items: input.items ?? [
        {
          threadId: 'thread-1',
          name: 'Current',
          preview: 'Current preview',
          updatedAtIso: null,
          current: true,
          cardError: null,
          operation: 'idle',
        },
        {
          threadId: 'thread-2',
          name: 'Second',
          preview: 'Second preview',
          updatedAtIso: null,
          current: false,
          cardError: input.secondThreadError ?? null,
          operation: 'idle',
        },
      ],
      nextCursor: input.nextCursor === undefined ? 'next-1' : input.nextCursor,
      loadMore: input.loadMore ?? {
        status: 'idle',
      },
    },
  };
}

interface CreateActivePageInput {
  readonly workspaceId?: string;
  readonly name?: string;
  readonly cwd?: string;
  readonly items?: readonly ClientWorkspaceThreadItemView[];
  readonly nextCursor?: string | null;
  readonly loadMore?: Extract<Extract<ClientWorkspacePanelPageView, { readonly kind: 'active-threads' }>['resource'], { readonly status: 'ready' }>['loadMore'];
  readonly secondThreadError?: { readonly code: string; readonly message: string } | null;
}

interface CreateWorkspaceItemInput {
  readonly workspaceId?: string;
  readonly recordRef?: string;
  readonly name?: string;
  readonly selected?: boolean;
  readonly operations?: readonly ClientWorkspaceListItemView['operations'][number][];
}

function createWorkspaceItem(input: CreateWorkspaceItemInput = {}): ClientWorkspaceListItemView {
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

interface CreateThreadItemInput {
  readonly threadId: string;
  readonly name: string;
  readonly preview: string;
  readonly current?: boolean;
  readonly operation?: 'idle' | 'resuming';
}

function createThreadItem(input: CreateThreadItemInput): ClientWorkspaceThreadItemView {
  return {
    threadId: input.threadId,
    name: input.name,
    preview: input.preview,
    updatedAtIso: null,
    current: input.current ?? false,
    cardError: null,
    operation: input.operation ?? 'idle',
  };
}
