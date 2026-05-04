import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { ClientWorkspaceListItemView } from '@my-code-x/contracts-new';

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
});

function createReadyState() {
  return {
    status: 'ready' as const,
    panel: createReadyPanel(),
    modal: {
      status: 'none' as const,
    },
    listError: null,
  };
}

interface CreateReadyPanelInput {
  readonly persistence?: 'persistent' | 'memory';
  readonly items?: readonly ClientWorkspaceListItemView[];
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
      selectedWorkspaceId: null,
      items: input.items ?? [
        {
          workspaceId: 'D:\\workspaces\\demo',
          recordRef: 'workspace-record-1',
          name: 'Demo',
          cwd: 'D:\\workspaces\\demo',
          availability: {
            status: 'available' as const,
          },
          selected: false,
          operations: ['rename' as const, 'edit-cwd' as const, 'remove' as const],
        },
      ],
    },
  };
}
