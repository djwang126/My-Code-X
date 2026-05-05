import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { ClientAction, ClientActionResult } from '@my-code-x/contracts-new';

import { createWorkspacePanelApiBoundary, WorkspacePanelApiError } from './workspace-panel-api.js';
import type { AppScope } from '../../../app/app-scope.js';

describe('workspace panel api boundary', () => {
  test('submits add workspace with raw cwd and raw name', async () => {
    const fixture = createApiFixture();

    await fixture.api.add({
      scope: createScope({ workspaceId: null }),
      cwd: '  D:\\workspaces\\demo  ',
      name: '  Demo  ',
    });

    assert.deepEqual(fixture.actions, [{
      kind: 'add-workspace',
      scope: createActionScope({ workspaceId: null }),
      payload: {
        cwd: '  D:\\workspaces\\demo  ',
        name: '  Demo  ',
      },
    }]);
  });

  test('submits rename workspace with empty raw name and nullable recordRef', async () => {
    const fixture = createApiFixture();

    await fixture.api.rename({
      scope: createScope({ workspaceId: 'D:\\workspaces\\selected' }),
      recordRef: null,
      currentWorkspaceId: 'D:\\workspaces\\demo',
      name: '',
    });

    assert.deepEqual(fixture.actions, [{
      kind: 'rename-workspace',
      scope: createActionScope({ workspaceId: 'D:\\workspaces\\selected' }),
      payload: {
        recordRef: null,
        currentWorkspaceId: 'D:\\workspaces\\demo',
        name: '',
      },
    }]);
  });

  test('sends workspace panel actions with current scope and payload', async () => {
    const fixture = createApiFixture();

    await fixture.api.open({ scope: createScope({ workspaceId: 'D:\\workspaces\\selected' }) });
    await fixture.api.editCwd({
      scope: createScope({ workspaceId: null }),
      recordRef: 'workspace-record-1',
      currentWorkspaceId: 'D:\\workspaces\\demo',
      cwd: '  D:\\workspaces\\renamed  ',
    });
    await fixture.api.remove({
      scope: createScope({ workspaceId: null }),
      recordRef: 'workspace-record-1',
      currentWorkspaceId: 'D:\\workspaces\\demo',
    });

    assert.deepEqual(fixture.actions, [
      {
        kind: 'open-workspace-panel',
        scope: createActionScope({ workspaceId: 'D:\\workspaces\\selected' }),
        payload: {},
      },
      {
        kind: 'edit-workspace-cwd',
        scope: createActionScope({ workspaceId: null }),
        payload: {
          recordRef: 'workspace-record-1',
          currentWorkspaceId: 'D:\\workspaces\\demo',
          cwd: '  D:\\workspaces\\renamed  ',
        },
      },
      {
        kind: 'remove-workspace',
        scope: createActionScope({ workspaceId: null }),
        payload: {
          recordRef: 'workspace-record-1',
          currentWorkspaceId: 'D:\\workspaces\\demo',
        },
      },
    ]);
  });

  test('sends active thread panel actions with current workspace and cursor', async () => {
    const fixture = createApiFixture();

    await fixture.api.openActiveThreads({
      scope: createScope({ workspaceId: null }),
      workspaceId: 'D:\\workspaces\\demo',
    });
    await fixture.api.loadMoreActiveThreads({
      scope: createScope({ workspaceId: 'D:\\workspaces\\demo' }),
      workspaceId: 'D:\\workspaces\\demo',
      cursor: 'next-1',
    });

    assert.deepEqual(fixture.actions, [
      {
        kind: 'open-workspace-active-threads',
        scope: createActionScope({ workspaceId: 'D:\\workspaces\\demo' }),
        payload: {
          workspaceId: 'D:\\workspaces\\demo',
        },
      },
      {
        kind: 'load-more-workspace-active-threads',
        scope: createActionScope({ workspaceId: 'D:\\workspaces\\demo' }),
        payload: {
          workspaceId: 'D:\\workspaces\\demo',
          cursor: 'next-1',
        },
      },
    ]);
  });

  test('sends resume thread action with thread in scope and strict empty payload', async () => {
    const fixture = createApiFixture();

    await fixture.api.resumeThread({
      scope: createScope({ workspaceId: null }),
      workspaceId: 'D:\\workspaces\\demo',
      threadId: 'thread-2',
    });

    assert.deepEqual(fixture.actions, [
      {
        kind: 'resume-thread',
        scope: {
          slotId: 'slot-1',
          workspaceId: 'D:\\workspaces\\demo',
          threadId: 'thread-2',
        },
        payload: {},
      },
    ]);
  });

  test('returns workspace panel from accepted action result', async () => {
    const fixture = createApiFixture({ result: createAcceptedActionResult({ persistence: 'memory' }) });

    const panel = await fixture.api.add({
      scope: createScope({ workspaceId: null }),
      cwd: 'D:\\workspaces\\demo',
      name: 'Demo',
    });

    assert.deepEqual(panel, createAcceptedActionResult({ persistence: 'memory' }).workspacePanel);
  });

  test('throws rejected action result message', async () => {
    const fixture = createApiFixture({
      result: {
        status: 'rejected',
        error: {
          code: 'missing',
          message: '路径不存在',
        },
      },
    });

    await assert.rejects(fixture.api.add({
      scope: createScope({ workspaceId: null }),
      cwd: 'D:\\workspaces\\missing',
      name: 'Missing',
    }), {
      name: 'WorkspacePanelApiError',
      code: 'missing',
      message: '路径不存在',
    });
  });

  test('throws typed error when opening active threads is rejected', async () => {
    const fixture = createApiFixture({
      result: {
        status: 'rejected',
        error: {
          code: 'workspace-unavailable',
          message: 'Workspace 不可用',
        },
      },
    });

    await assert.rejects(fixture.api.openActiveThreads({
      scope: createScope({ workspaceId: null }),
      workspaceId: 'D:\\workspaces\\missing',
    }), {
      name: 'WorkspacePanelApiError',
      code: 'workspace-unavailable',
      message: 'Workspace 不可用',
    });
  });

  test('returns rejected resume action result for controller-level card errors', async () => {
    const result: ClientActionResult = {
      status: 'rejected',
      error: {
        code: 'thread-resume-failed',
        message: 'Thread 恢复失败',
      },
    };
    const fixture = createApiFixture({ result });

    const actual = await fixture.api.resumeThread({
      scope: createScope({ workspaceId: null }),
      workspaceId: 'D:\\workspaces\\demo',
      threadId: 'thread-2',
    });

    assert.deepEqual(actual, result);
  });

  test('exposes typed workspace panel api errors', () => {
    const error = new WorkspacePanelApiError('duplicate-workspace', 'Workspace 已存在');

    assert.equal(error.name, 'WorkspacePanelApiError');
    assert.equal(error.code, 'duplicate-workspace');
    assert.equal(error.message, 'Workspace 已存在');
  });
});

interface CreateApiFixtureInput {
  readonly result?: ClientActionResult;
}

function createApiFixture(input: CreateApiFixtureInput = {}) {
  const actions: ClientAction[] = [];
  const result = input.result ?? createAcceptedActionResult({ persistence: 'persistent' });

  return {
    actions,
    api: createWorkspacePanelApiBoundary({
      async sendAction(action) {
        actions.push(action);
        return result;
      },
    }),
  };
}

interface CreateAcceptedActionResultInput {
  readonly persistence: 'persistent' | 'memory';
}

function createAcceptedActionResult(input: CreateAcceptedActionResultInput): Extract<ClientActionResult, { status: 'accepted' }> {
  return {
    status: 'accepted',
    snapshot: null,
    events: [],
    workspacePanel: {
      status: 'ready',
      list: {
        persistence: input.persistence === 'memory'
          ? {
              status: 'memory',
              warning: '当前 Workspace 变更不会持久保存',
              error: { code: 'registry-unreadable', message: 'Workspace 配置不可读' },
            }
          : { status: 'persistent' },
        selectedWorkspaceId: null,
        items: [],
      },
      page: {
        kind: 'workspace-list',
      },
    },
  };
}

interface CreateScopeInput {
  readonly workspaceId: string | null;
}

function createScope(input: CreateScopeInput): AppScope {
  return {
    slotId: 'slot-1',
    workspaceId: input.workspaceId,
    threadId: null,
    label: 'test scope',
  };
}

function createActionScope(input: CreateScopeInput) {
  return {
    slotId: 'slot-1',
    workspaceId: input.workspaceId,
    threadId: null,
  };
}
