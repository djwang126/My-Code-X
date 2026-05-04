import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  clientActionResultSchema,
  clientActionSchema,
  clientWorkspacePanelViewSchema,
} from './index.js';

describe('workspace panel contracts', () => {
  test('parses open workspace panel action', () => {
    const action = {
      kind: 'open-workspace-panel',
      scope: createScope(),
      payload: {},
    };

    assert.deepEqual(clientActionSchema.parse(action), action);
  });

  test('parses add workspace action with raw cwd and raw name', () => {
    const action = {
      kind: 'add-workspace',
      scope: createScope(),
      payload: {
        cwd: '  D:\\workspaces\\demo  ',
        name: '  Demo  ',
      },
    };

    assert.deepEqual(clientActionSchema.parse(action), action);
  });

  test('parses rename workspace action with empty name', () => {
    const action = {
      kind: 'rename-workspace',
      scope: createScope(),
      payload: {
        recordRef: 'workspace-record-1',
        currentWorkspaceId: 'D:\\workspaces\\demo',
        name: '',
      },
    };

    assert.deepEqual(clientActionSchema.parse(action), action);
  });

  test('parses edit workspace cwd action', () => {
    const action = {
      kind: 'edit-workspace-cwd',
      scope: createScope(),
      payload: {
        recordRef: 'workspace-record-1',
        currentWorkspaceId: 'D:\\workspaces\\demo',
        cwd: '  D:\\workspaces\\renamed  ',
      },
    };

    assert.deepEqual(clientActionSchema.parse(action), action);
  });

  test('parses remove workspace action', () => {
    const action = {
      kind: 'remove-workspace',
      scope: createScope(),
      payload: {
        recordRef: 'workspace-record-1',
        currentWorkspaceId: 'D:\\workspaces\\demo',
      },
    };

    assert.deepEqual(clientActionSchema.parse(action), action);
  });

  test('rejects add workspace action with invalid payload', () => {
    assert.equal(clientActionSchema.safeParse({
      kind: 'add-workspace',
      scope: createScope(),
      payload: {
        cwd: 'D:\\workspaces\\demo',
      },
    }).success, false);

    assert.equal(clientActionSchema.safeParse({
      kind: 'add-workspace',
      scope: createScope(),
      payload: {
        cwd: 123,
        name: 'Demo',
      },
    }).success, false);
  });

  test('parses workspace mutation actions when recordRef is unavailable', () => {
    const renameAction = {
      kind: 'rename-workspace',
      scope: createScope(),
      payload: {
        recordRef: null,
        currentWorkspaceId: 'D:\\workspaces\\demo',
        name: 'Demo',
      },
    };
    const editAction = {
      kind: 'edit-workspace-cwd',
      scope: createScope(),
      payload: {
        recordRef: null,
        currentWorkspaceId: 'D:\\workspaces\\demo',
        cwd: 'D:\\workspaces\\renamed',
      },
    };
    const removeAction = {
      kind: 'remove-workspace',
      scope: createScope(),
      payload: {
        recordRef: null,
        currentWorkspaceId: 'D:\\workspaces\\demo',
      },
    };

    assert.deepEqual(clientActionSchema.parse(renameAction), renameAction);
    assert.deepEqual(clientActionSchema.parse(editAction), editAction);
    assert.deepEqual(clientActionSchema.parse(removeAction), removeAction);
  });

  test('rejects workspace mutation with invalid target fields', () => {
    assert.equal(clientActionSchema.safeParse({
      kind: 'rename-workspace',
      scope: createScope(),
      payload: {
        currentWorkspaceId: 'D:\\workspaces\\demo',
        name: 'Demo',
      },
    }).success, false);

    assert.equal(clientActionSchema.safeParse({
      kind: 'remove-workspace',
      scope: createScope(),
      payload: {
        recordRef: 123,
        currentWorkspaceId: 'D:\\workspaces\\demo',
      },
    }).success, false);

    assert.equal(clientActionSchema.safeParse({
      kind: 'edit-workspace-cwd',
      scope: createScope(),
      payload: {
        recordRef: 'workspace-record-1',
        currentWorkspaceId: 'D:\\workspaces\\demo',
      },
    }).success, false);
  });

  test('parses loading and failed workspace panel views', () => {
    const loading = {
      status: 'loading',
    };
    const failed = {
      status: 'failed',
      error: {
        code: 'workspace-list-failed',
        message: 'Workspace 列表加载失败',
      },
    };

    assert.deepEqual(clientWorkspacePanelViewSchema.parse(loading), loading);
    assert.deepEqual(clientWorkspacePanelViewSchema.parse(failed), failed);
  });

  test('parses ready persistent workspace panel with available and unavailable items', () => {
    const panel = createReadyWorkspacePanel({ persistence: 'persistent' });

    assert.deepEqual(clientWorkspacePanelViewSchema.parse(panel), panel);
  });

  test('parses ready memory workspace panel with persistence warning', () => {
    const panel = createReadyWorkspacePanel({
      persistence: 'memory',
    });

    assert.deepEqual(clientWorkspacePanelViewSchema.parse(panel), panel);
  });

  test('parses workspace action result with and without panel projection', () => {
    const withPanel = {
      status: 'accepted',
      snapshot: null,
      events: [],
      workspacePanel: createReadyWorkspacePanel({ persistence: 'persistent' }),
    };
    const withoutPanel = {
      status: 'accepted',
      snapshot: null,
      events: [],
      workspacePanel: null,
    };

    assert.deepEqual(clientActionResultSchema.parse(withPanel), withPanel);
    assert.deepEqual(clientActionResultSchema.parse(withoutPanel), withoutPanel);
  });

  test('rejects inconsistent workspace list resource states', () => {
    assert.equal(clientWorkspacePanelViewSchema.safeParse(createReadyWorkspacePanel({
      persistence: 'memory',
      omitMemoryWarning: true,
    })).success, false);

    assert.equal(clientWorkspacePanelViewSchema.safeParse({
      status: 'ready',
      list: {
        persistence: {
          status: 'persistent',
          warning: '当前 Workspace 变更不会持久保存',
        },
        selectedWorkspaceId: null,
        items: [],
      },
    }).success, false);

    assert.equal(clientWorkspacePanelViewSchema.safeParse({
      status: 'ready',
      list: {
        persistence: {
          status: 'memory',
          error: { code: 'registry-unreadable', message: 'Workspace 配置不可读' },
        },
        selectedWorkspaceId: null,
        items: [],
      },
    }).success, false);
  });

  test('parses rejected action result with typed error', () => {
    const result = {
      status: 'rejected',
      error: {
        code: 'duplicate-workspace',
        message: 'Workspace 已存在',
      },
    };

    assert.deepEqual(clientActionResultSchema.parse(result), result);
  });

  test('rejects legacy rejected action result message', () => {
    assert.equal(clientActionResultSchema.safeParse({
      status: 'rejected',
      message: 'Workspace 已存在',
    }).success, false);
  });

  test('rejects legacy workspace persistence nullable fields', () => {
    assert.equal(clientWorkspacePanelViewSchema.safeParse({
      status: 'ready',
      list: {
        persistence: 'persistent',
        warning: '当前 Workspace 变更不会持久保存',
        persistenceError: null,
        selectedWorkspaceId: null,
        items: [],
      },
    }).success, false);
  });

  test('rejects invalid workspace list item states and operations', () => {
    assert.equal(clientWorkspacePanelViewSchema.safeParse({
      status: 'ready',
      list: {
        persistence: { status: 'persistent' },
        selectedWorkspaceId: null,
        items: [
          {
            workspaceId: 'D:\\workspaces\\demo',
            recordRef: 'workspace-record-1',
            name: 'Demo',
            cwd: 'D:\\workspaces\\demo',
            availability: {
              status: 'available',
              reason: '路径不存在',
            },
            selected: false,
            operations: ['rename'],
          },
        ],
      },
    }).success, false);

    assert.equal(clientWorkspacePanelViewSchema.safeParse({
      status: 'ready',
      list: {
        persistence: { status: 'persistent' },
        selectedWorkspaceId: null,
        items: [
          {
            workspaceId: 'D:\\workspaces\\missing',
            recordRef: 'workspace-record-1',
            name: 'Missing',
            cwd: 'D:\\workspaces\\missing',
            availability: {
              status: 'unavailable',
            },
            selected: false,
            operations: ['remove'],
          },
        ],
      },
    }).success, false);

    assert.equal(clientWorkspacePanelViewSchema.safeParse({
      status: 'ready',
      list: {
        persistence: { status: 'persistent' },
        selectedWorkspaceId: null,
        items: [
          {
            workspaceId: 'D:\\workspaces\\demo',
            recordRef: 'workspace-record-1',
            name: 'Demo',
            cwd: 'D:\\workspaces\\demo',
            availability: {
              status: 'available',
            },
            selected: false,
            operations: ['delete-directory'],
          },
        ],
      },
    }).success, false);
  });
});

function createScope() {
  return {
    slotId: 'slot-1',
    workspaceId: null,
    threadId: null,
  };
}

interface CreateReadyWorkspacePanelInput {
  readonly persistence: 'persistent' | 'memory';
  readonly omitMemoryWarning?: boolean;
}

function createReadyWorkspacePanel(input: CreateReadyWorkspacePanelInput) {
  return {
    status: 'ready',
    list: {
      persistence: input.persistence === 'memory'
        ? {
            status: 'memory',
            ...(input.omitMemoryWarning ? {} : { warning: '当前 Workspace 变更不会持久保存' }),
            error: { code: 'registry-unreadable', message: 'Workspace 配置不可读' },
          }
        : { status: 'persistent' },
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
        {
          workspaceId: 'D:\\workspaces\\missing',
          recordRef: 'workspace-record-2',
          name: '',
          cwd: 'D:\\workspaces\\missing',
          availability: {
            status: 'unavailable',
            reason: '路径不存在',
          },
          selected: false,
          operations: ['remove'],
        },
      ],
    },
  };
}
