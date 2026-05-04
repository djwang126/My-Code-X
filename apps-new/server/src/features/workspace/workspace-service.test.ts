import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createWorkspaceService } from './workspace-service.js';
import type {
  AppDataStorePort,
  ClockPort,
  IdPort,
  PathComparisonPort,
  PathInspectionPort,
} from '../../ports/index.js';
import type { WorkspaceListSnapshot, WorkspaceRegistry, WorkspaceService } from './index.js';

describe('Workspace Registry management', () => {
  test('opens an empty persistent workspace list when registry does not exist', async () => {
    const fixture = createWorkspaceFixture();

    const list = await fixture.service.openList({ selectedWorkspaceId: null });

    assert.deepEqual(list, createExpectedList({ items: [] }));
  });

  test('opens saved workspaces in created order', async () => {
    const fixture = createWorkspaceFixture({
      registry: createRegistry([
        createRecord({ id: 'workspace-record-1', cwd: 'D:\\workspaces\\one', name: 'One', createdAt: '2026-05-04T00:00:00.000Z' }),
        createRecord({ id: 'workspace-record-2', cwd: 'D:\\workspaces\\two', name: 'Two', createdAt: '2026-05-04T00:00:01.000Z' }),
      ]),
      paths: {
        'D:\\workspaces\\one': createAvailablePath('D:\\workspaces\\one', 'one'),
        'D:\\workspaces\\two': createAvailablePath('D:\\workspaces\\two', 'two'),
      },
    });

    const list = await fixture.service.openList({ selectedWorkspaceId: null });

    assert.deepEqual(list, createExpectedList({
      items: [
        createExpectedItem({ workspaceId: 'D:\\workspaces\\one', recordRef: 'workspace-record-1', name: 'One', cwd: 'D:\\workspaces\\one' }),
        createExpectedItem({ workspaceId: 'D:\\workspaces\\two', recordRef: 'workspace-record-2', name: 'Two', cwd: 'D:\\workspaces\\two' }),
      ],
    }));
  });

  test('inspects no workspace when client has no workspace scope', async () => {
    const fixture = createWorkspaceFixture();

    assert.deepEqual(await fixture.service.inspectSavedWorkspace({ workspaceId: null }), {
      status: 'none',
    });
  });

  test('inspects an unavailable workspace when scope is not saved', async () => {
    const fixture = createWorkspaceFixture();

    assert.deepEqual(await fixture.service.inspectSavedWorkspace({ workspaceId: 'D:\\workspaces\\missing' }), {
      status: 'unavailable',
      workspaceId: 'D:\\workspaces\\missing',
      reason: 'not-saved',
      message: 'Workspace 未保存',
    });
  });

  test('inspects an unavailable workspace when saved cwd is unavailable', async () => {
    const fixture = createWorkspaceFixture({
      registry: createRegistry([
        createRecord({ id: 'workspace-record-1', cwd: 'D:\\workspaces\\missing', name: 'Missing' }),
      ]),
      invalidPaths: {
        'D:\\workspaces\\missing': createInvalidPath('missing', '路径不存在'),
      },
    });

    assert.deepEqual(await fixture.service.inspectSavedWorkspace({ workspaceId: 'D:\\workspaces\\missing' }), {
      status: 'unavailable',
      workspaceId: 'D:\\workspaces\\missing',
      reason: 'path-unavailable',
      message: '路径不存在',
    });
  });

  test('inspects a saved available workspace as canonical workspace id', async () => {
    const fixture = createWorkspaceFixture({
      registry: createRegistry([
        createRecord({ id: 'workspace-record-1', cwd: 'D:\\workspaces\\demo', name: 'Demo' }),
      ]),
      paths: {
        'D:\\workspaces\\demo': createAvailablePath('D:\\workspaces\\demo', 'demo'),
      },
    });

    assert.deepEqual(await fixture.service.inspectSavedWorkspace({ workspaceId: 'd:\\WORKSPACES\\DEMO' }), {
      status: 'available',
      workspaceId: 'D:\\workspaces\\demo',
    });
  });

  test('marks unavailable workspaces as removable only', async () => {
    const fixture = createWorkspaceFixture({
      registry: createRegistry([
        createRecord({ id: 'workspace-record-1', cwd: 'D:\\workspaces\\missing', name: 'Missing' }),
      ]),
      invalidPaths: {
        'D:\\workspaces\\missing': createInvalidPath('missing', '路径不存在'),
      },
    });

    const unavailable = await fixture.service.openList({ selectedWorkspaceId: null });
    assert.deepEqual(unavailable, createExpectedList({
      items: [
        createExpectedItem({
          workspaceId: 'D:\\workspaces\\missing',
          recordRef: 'workspace-record-1',
          name: 'Missing',
          cwd: 'D:\\workspaces\\missing',
          availability: { status: 'unavailable', reason: '路径不存在' },
          operations: ['remove'],
        }),
      ],
    }));
  });

  test('does not persist unavailable availability result', async () => {
    const fixture = createWorkspaceFixture({
      registry: createRegistry([
        createRecord({ id: 'workspace-record-1', cwd: 'D:\\workspaces\\missing', name: 'Missing' }),
      ]),
      invalidPaths: {
        'D:\\workspaces\\missing': createInvalidPath('missing', '路径不存在'),
      },
    });

    await fixture.service.openList({ selectedWorkspaceId: null });

    fixture.paths.setAvailable('D:\\workspaces\\missing', createAvailablePath('D:\\workspaces\\missing', 'missing'));

    const available = await fixture.service.openList({ selectedWorkspaceId: null });
    assert.deepEqual(available, createExpectedList({
      items: [
        createExpectedItem({
          workspaceId: 'D:\\workspaces\\missing',
          recordRef: 'workspace-record-1',
          name: 'Missing',
          cwd: 'D:\\workspaces\\missing',
        }),
      ],
    }));
    assert.deepEqual(fixture.appData.writes, []);
  });

  test('disables remove for selected available workspace', async () => {
    const fixture = createWorkspaceFixture({
      registry: createRegistry([
        createRecord({ id: 'workspace-record-1', cwd: 'D:\\workspaces\\demo', name: 'Demo' }),
      ]),
      paths: {
        'D:\\workspaces\\demo': createAvailablePath('D:\\workspaces\\demo', 'demo'),
      },
    });

    const list = await fixture.service.openList({ selectedWorkspaceId: 'D:\\workspaces\\demo' });

    assert.deepEqual(list, createExpectedList({
      selectedWorkspaceId: 'D:\\workspaces\\demo',
      items: [
        createExpectedItem({
          workspaceId: 'D:\\workspaces\\demo',
          recordRef: 'workspace-record-1',
          name: 'Demo',
          cwd: 'D:\\workspaces\\demo',
          selected: true,
          operations: ['rename', 'edit-cwd'],
        }),
      ],
    }));
  });

  test('does not select unavailable workspace even when selectedWorkspaceId matches and allows remove', async () => {
    const fixture = createWorkspaceFixture({
      registry: createRegistry([
        createRecord({ id: 'workspace-record-1', cwd: 'D:\\workspaces\\missing', name: 'Missing' }),
      ]),
      invalidPaths: {
        'D:\\workspaces\\missing': createInvalidPath('missing', '路径不存在'),
      },
    });

    const list = await fixture.service.openList({ selectedWorkspaceId: 'D:\\workspaces\\missing' });

    assert.deepEqual(list, createExpectedList({
      selectedWorkspaceId: null,
      items: [
        createExpectedItem({
          workspaceId: 'D:\\workspaces\\missing',
          recordRef: 'workspace-record-1',
          name: 'Missing',
          cwd: 'D:\\workspaces\\missing',
          availability: { status: 'unavailable', reason: '路径不存在' },
          selected: false,
          operations: ['remove'],
        }),
      ],
    }));

    assert.deepEqual(await fixture.service.remove({
      recordRef: 'workspace-record-1',
      currentWorkspaceId: 'D:\\workspaces\\missing',
      selectedWorkspaceId: null,
    }), createExpectedList({
      selectedWorkspaceId: null,
      items: [],
    }));
  });

  test('adds a workspace with trimmed canonical cwd and basename fallback name', async () => {
    const fixture = createWorkspaceFixture({
      paths: {
        'D:\\workspaces\\demo': createAvailablePath('D:\\workspaces\\demo', 'demo'),
      },
    });

    const list = await fixture.service.add({
      cwd: '  D:\\workspaces\\demo  ',
      name: '',
      selectedWorkspaceId: null,
    });

    assert.deepEqual(list, createExpectedList({
      items: [
        createExpectedItem({ workspaceId: 'D:\\workspaces\\demo', recordRef: 'workspace-record-1', name: 'demo', cwd: 'D:\\workspaces\\demo' }),
      ],
    }));
  });

  test('preserves non-empty add name exactly', async () => {
    const fixture = createWorkspaceFixture({
      paths: {
        'D:\\workspaces\\demo': createAvailablePath('D:\\workspaces\\demo', 'demo'),
      },
    });

    const list = await fixture.service.add({
      cwd: 'D:\\workspaces\\demo',
      name: '  My Repo  ',
      selectedWorkspaceId: null,
    });

    assert.deepEqual(list, createExpectedList({
      items: [
        createExpectedItem({ workspaceId: 'D:\\workspaces\\demo', recordRef: 'workspace-record-1', name: '  My Repo  ', cwd: 'D:\\workspaces\\demo' }),
      ],
    }));
  });

  test('rejects empty add cwd', async () => {
    await assertAddValidationFailure({ cwd: '   ', code: 'empty', message: 'cwd 必填' });
  });

  test('rejects relative add cwd', async () => {
    await assertAddValidationFailure({ cwd: 'relative\\path', code: 'relative', message: '路径必须是绝对路径' });
  });

  test('rejects missing add cwd', async () => {
    await assertAddValidationFailure({ cwd: 'D:\\workspaces\\missing', code: 'missing', message: '路径不存在' });
  });

  test('rejects file add cwd', async () => {
    await assertAddValidationFailure({ cwd: 'D:\\workspaces\\file.txt', code: 'not-directory', message: '路径不是目录' });
  });

  test('rejects inaccessible add cwd', async () => {
    await assertAddValidationFailure({ cwd: 'D:\\workspaces\\private', code: 'inaccessible', message: '路径不可访问' });
  });

  test('rejects add cwd when canonicalization fails', async () => {
    await assertAddValidationFailure({ cwd: 'D:\\workspaces\\broken', code: 'canonicalization-failed', message: '路径不可解析' });
  });

  test('keeps list unchanged after add validation failure', async () => {
    const fixture = createFixtureWithExistingWorkspace({
      invalidPaths: {
        'D:\\workspaces\\missing': createInvalidPath('missing', '路径不存在'),
      },
    });

    await assert.rejects(fixture.service.add({ cwd: 'D:\\workspaces\\missing', name: 'Missing', selectedWorkspaceId: null }), {
      name: 'WorkspaceValidationError',
      code: 'missing',
    });

    assert.deepEqual(await fixture.service.openList({ selectedWorkspaceId: null }), createExpectedList({
      items: [
        createExpectedItem({ workspaceId: 'D:\\workspaces\\existing', recordRef: 'workspace-record-1', name: 'Existing', cwd: 'D:\\workspaces\\existing' }),
      ],
    }));
  });

  test('rejects duplicate canonical cwd', async () => {
    const fixture = createWorkspaceFixture({
      registry: createRegistry([
        createRecord({ id: 'workspace-record-1', cwd: 'D:\\workspaces\\demo', name: 'Demo' }),
      ]),
      paths: {
        'D:\\workspaces\\demo': createAvailablePath('D:\\workspaces\\demo', 'demo'),
        'D:\\WORKSPACES\\DEMO': createAvailablePath('D:\\workspaces\\demo', 'demo'),
      },
    });

    await assert.rejects(fixture.service.add({
      cwd: 'D:\\WORKSPACES\\DEMO',
      name: 'Duplicate',
      selectedWorkspaceId: null,
    }), {
      name: 'WorkspaceConflictError',
      code: 'duplicate-workspace',
    });

    assert.deepEqual(await fixture.service.openList({ selectedWorkspaceId: null }), createExpectedList({
      items: [
        createExpectedItem({ workspaceId: 'D:\\workspaces\\demo', recordRef: 'workspace-record-1', name: 'Demo', cwd: 'D:\\workspaces\\demo' }),
      ],
    }));
  });

  test('rejects duplicate workspace when Windows canonical paths differ only by case', async () => {
    const fixture = createWorkspaceFixture({
      registry: createRegistry([
        createRecord({ id: 'workspace-record-1', cwd: 'D:\\Repo', name: 'Repo' }),
      ]),
      paths: {
        'D:\\Repo': createAvailablePath('D:\\Repo', 'Repo'),
        'd:\\repo': createAvailablePath('d:\\repo', 'repo'),
      },
    });

    await assert.rejects(fixture.service.add({
      cwd: 'd:\\repo',
      name: 'Duplicate',
      selectedWorkspaceId: null,
    }), {
      name: 'WorkspaceConflictError',
      code: 'duplicate-workspace',
    });
  });


  test('duplicate detection uses injected path comparison policy', async () => {
    const fixture = createWorkspaceFixture({
      registry: createRegistry([
        createRecord({ id: 'workspace-record-existing', cwd: 'D:\\Repo', name: 'Repo' }),
      ]),
      paths: {
        'D:\\Repo': createAvailablePath('D:\\Repo', 'Repo'),
        'd:\\repo': createAvailablePath('d:\\repo', 'repo'),
      },
      pathComparison: {
        samePath(input) {
          return input.left === input.right;
        },
      },
    });

    const list = await fixture.service.add({
      cwd: 'd:\\repo',
      name: 'Lowercase repo',
      selectedWorkspaceId: null,
    });

    assert.deepEqual(list, createExpectedList({
      items: [
        createExpectedItem({ workspaceId: 'D:\\Repo', recordRef: 'workspace-record-existing', name: 'Repo', cwd: 'D:\\Repo' }),
        createExpectedItem({ workspaceId: 'd:\\repo', recordRef: 'workspace-record-1', name: 'Lowercase repo', cwd: 'd:\\repo' }),
      ],
    }));
  });

  test('renames a workspace by recordRef and allows an empty display name', async () => {
    const fixture = createWorkspaceFixture({
      registry: createRegistry([
        createRecord({ id: 'workspace-record-1', cwd: 'D:\\workspaces\\demo', name: 'Demo' }),
      ]),
      paths: {
        'D:\\workspaces\\demo': createAvailablePath('D:\\workspaces\\demo', 'demo'),
      },
    });

    const list = await fixture.service.rename({
      recordRef: 'workspace-record-1',
      currentWorkspaceId: 'D:\\workspaces\\demo',
      name: '',
      selectedWorkspaceId: null,
    });

    assert.deepEqual(list, createExpectedList({
      items: [
        createExpectedItem({ workspaceId: 'D:\\workspaces\\demo', recordRef: 'workspace-record-1', name: '', cwd: 'D:\\workspaces\\demo' }),
      ],
    }));
  });

  test('renames by currentWorkspaceId when recordRef is unavailable', async () => {
    const fixture = createWorkspaceFixture({
      registry: createRegistry([
        createRecord({ id: 'workspace-record-1', cwd: 'D:\\workspaces\\demo', name: 'Demo' }),
      ]),
      paths: {
        'D:\\workspaces\\demo': createAvailablePath('D:\\workspaces\\demo', 'demo'),
      },
    });

    const list = await fixture.service.rename({
      recordRef: null,
      currentWorkspaceId: 'D:\\workspaces\\demo',
      name: 'Renamed',
      selectedWorkspaceId: null,
    });

    assert.deepEqual(list, createExpectedList({
      items: [
        createExpectedItem({ workspaceId: 'D:\\workspaces\\demo', recordRef: 'workspace-record-1', name: 'Renamed', cwd: 'D:\\workspaces\\demo' }),
      ],
    }));
  });

  test('fails rename when target record does not exist and leaves list unchanged', async () => {
    const fixture = createWorkspaceFixture({
      registry: createRegistry([
        createRecord({ id: 'workspace-record-1', cwd: 'D:\\workspaces\\demo', name: 'Demo' }),
      ]),
      paths: {
        'D:\\workspaces\\demo': createAvailablePath('D:\\workspaces\\demo', 'demo'),
      },
    });

    await assert.rejects(fixture.service.rename({
      recordRef: 'workspace-record-missing',
      currentWorkspaceId: 'D:\\workspaces\\demo',
      name: 'Renamed',
      selectedWorkspaceId: null,
    }), {
      name: 'WorkspaceConflictError',
      code: 'workspace-not-found',
    });

    assert.deepEqual(await fixture.service.openList({ selectedWorkspaceId: null }), createExpectedList({
      items: [
        createExpectedItem({ workspaceId: 'D:\\workspaces\\demo', recordRef: 'workspace-record-1', name: 'Demo', cwd: 'D:\\workspaces\\demo' }),
      ],
    }));
  });

  test('edits workspace cwd while preserving recordRef and name', async () => {
    const fixture = createWorkspaceFixture({
      registry: createRegistry([
        createRecord({ id: 'workspace-record-1', cwd: 'D:\\workspaces\\demo', name: 'Demo Name' }),
      ]),
      paths: {
        'D:\\workspaces\\demo': createAvailablePath('D:\\workspaces\\demo', 'demo'),
        'D:\\workspaces\\renamed': createAvailablePath('D:\\workspaces\\renamed', 'renamed'),
      },
    });

    const list = await fixture.service.editCwd({
      recordRef: 'workspace-record-1',
      currentWorkspaceId: 'D:\\workspaces\\demo',
      cwd: '  D:\\workspaces\\renamed  ',
      selectedWorkspaceId: null,
    });

    assert.deepEqual(list, createExpectedList({
      items: [
        createExpectedItem({ workspaceId: 'D:\\workspaces\\renamed', recordRef: 'workspace-record-1', name: 'Demo Name', cwd: 'D:\\workspaces\\renamed' }),
      ],
    }));
  });

  test('editing selected workspace cwd moves selected identity to new canonical cwd', async () => {
    const fixture = createWorkspaceFixture({
      registry: createRegistry([
        createRecord({ id: 'workspace-record-1', cwd: 'D:\\workspaces\\demo', name: 'Demo Name' }),
      ]),
      paths: {
        'D:\\workspaces\\demo': createAvailablePath('D:\\workspaces\\demo', 'demo'),
        'D:\\workspaces\\renamed': createAvailablePath('D:\\workspaces\\renamed', 'renamed'),
      },
    });

    const list = await fixture.service.editCwd({
      recordRef: 'workspace-record-1',
      currentWorkspaceId: 'D:\\workspaces\\demo',
      cwd: 'D:\\workspaces\\renamed',
      selectedWorkspaceId: 'D:\\workspaces\\demo',
    });

    assert.deepEqual(list, createExpectedList({
      selectedWorkspaceId: 'D:\\workspaces\\renamed',
      items: [
        createExpectedItem({
          workspaceId: 'D:\\workspaces\\renamed',
          recordRef: 'workspace-record-1',
          name: 'Demo Name',
          cwd: 'D:\\workspaces\\renamed',
          selected: true,
          operations: ['rename', 'edit-cwd'],
        }),
      ],
    }));
  });

  test('rejects edit cwd when new cwd is invalid', async () => {
    const fixture = createTwoWorkspaceFixture({
      invalidPaths: {
        'D:\\workspaces\\missing': createInvalidPath('missing', '路径不存在'),
      },
    });

    await assert.rejects(fixture.service.editCwd({
      recordRef: 'workspace-record-1',
      currentWorkspaceId: 'D:\\workspaces\\one',
      cwd: 'D:\\workspaces\\missing',
      selectedWorkspaceId: null,
    }), {
      name: 'WorkspaceValidationError',
      code: 'missing',
    });
  });

  test('rejects edit cwd when new canonical cwd belongs to another workspace', async () => {
    const fixture = createTwoWorkspaceFixture();

    await assert.rejects(fixture.service.editCwd({
      recordRef: 'workspace-record-1',
      currentWorkspaceId: 'D:\\workspaces\\one',
      cwd: 'D:\\workspaces\\two',
      selectedWorkspaceId: null,
    }), {
      name: 'WorkspaceConflictError',
      code: 'duplicate-workspace',
    });
  });

  test('keeps list unchanged after edit cwd failure', async () => {
    const fixture = createTwoWorkspaceFixture({
      invalidPaths: {
        'D:\\workspaces\\missing': createInvalidPath('missing', '路径不存在'),
      },
    });

    await assert.rejects(fixture.service.editCwd({
      recordRef: 'workspace-record-1',
      currentWorkspaceId: 'D:\\workspaces\\one',
      cwd: 'D:\\workspaces\\missing',
      selectedWorkspaceId: null,
    }), {
      name: 'WorkspaceValidationError',
      code: 'missing',
    });

    assert.deepEqual(await fixture.service.openList({ selectedWorkspaceId: null }), createExpectedList({
      items: [
        createExpectedItem({ workspaceId: 'D:\\workspaces\\one', recordRef: 'workspace-record-1', name: 'One', cwd: 'D:\\workspaces\\one' }),
        createExpectedItem({ workspaceId: 'D:\\workspaces\\two', recordRef: 'workspace-record-2', name: 'Two', cwd: 'D:\\workspaces\\two' }),
      ],
    }));
  });

  test('fails stale cwd-only edit after concurrent cwd edit made old identity unavailable', async () => {
    const fixture = createWorkspaceFixture({
      registry: createRegistry([
        createRecord({ id: 'workspace-record-1', cwd: 'D:\\workspaces\\new', name: 'Demo' }),
      ]),
      paths: {
        'D:\\workspaces\\new': createAvailablePath('D:\\workspaces\\new', 'new'),
        'D:\\workspaces\\other': createAvailablePath('D:\\workspaces\\other', 'other'),
      },
    });

    await assert.rejects(fixture.service.editCwd({
      recordRef: null,
      currentWorkspaceId: 'D:\\workspaces\\old',
      cwd: 'D:\\workspaces\\other',
      selectedWorkspaceId: null,
    }), {
      name: 'WorkspaceConflictError',
      code: 'workspace-not-found',
    });
  });

  test('removes available workspace record', async () => {
    const fixture = createAvailableAndUnavailableRemoveFixture();

    const list = await fixture.service.remove({
      recordRef: 'workspace-record-1',
      currentWorkspaceId: 'D:\\workspaces\\available',
      selectedWorkspaceId: null,
    });

    assert.deepEqual(list, createExpectedList({
      items: [
        createExpectedItem({
          workspaceId: 'D:\\workspaces\\missing',
          recordRef: 'workspace-record-2',
          name: 'Missing',
          cwd: 'D:\\workspaces\\missing',
          availability: { status: 'unavailable', reason: '路径不存在' },
          operations: ['remove'],
        }),
      ],
    }));
  });

  test('removes unavailable workspace record', async () => {
    const fixture = createAvailableAndUnavailableRemoveFixture();

    const list = await fixture.service.remove({
      recordRef: 'workspace-record-2',
      currentWorkspaceId: 'D:\\workspaces\\missing',
      selectedWorkspaceId: null,
    });

    assert.deepEqual(list, createExpectedList({
      items: [
        createExpectedItem({
          workspaceId: 'D:\\workspaces\\available',
          recordRef: 'workspace-record-1',
          name: 'Available',
          cwd: 'D:\\workspaces\\available',
        }),
      ],
    }));
  });

  test('fails remove when target record does not exist and leaves list unchanged', async () => {
    const fixture = createWorkspaceFixture({
      registry: createRegistry([
        createRecord({ id: 'workspace-record-1', cwd: 'D:\\workspaces\\demo', name: 'Demo' }),
      ]),
      paths: {
        'D:\\workspaces\\demo': createAvailablePath('D:\\workspaces\\demo', 'demo'),
      },
    });

    await assert.rejects(fixture.service.remove({
      recordRef: 'workspace-record-missing',
      currentWorkspaceId: 'D:\\workspaces\\missing',
      selectedWorkspaceId: null,
    }), {
      name: 'WorkspaceConflictError',
      code: 'workspace-not-found',
    });

    assert.deepEqual(await fixture.service.openList({ selectedWorkspaceId: null }), createExpectedList({
      items: [
        createExpectedItem({ workspaceId: 'D:\\workspaces\\demo', recordRef: 'workspace-record-1', name: 'Demo', cwd: 'D:\\workspaces\\demo' }),
      ],
    }));
  });

  test('rejects removing selected workspace and leaves list unchanged', async () => {
    const fixture = createWorkspaceFixture({
      registry: createRegistry([
        createRecord({ id: 'workspace-record-1', cwd: 'D:\\workspaces\\demo', name: 'Demo' }),
      ]),
      paths: {
        'D:\\workspaces\\demo': createAvailablePath('D:\\workspaces\\demo', 'demo'),
      },
    });

    await assert.rejects(fixture.service.remove({
      recordRef: 'workspace-record-1',
      currentWorkspaceId: 'D:\\workspaces\\demo',
      selectedWorkspaceId: 'D:\\workspaces\\demo',
    }), {
      name: 'WorkspaceConflictError',
      code: 'selected-workspace-remove-forbidden',
    });

    assert.deepEqual(await fixture.service.openList({ selectedWorkspaceId: 'D:\\workspaces\\demo' }), createExpectedList({
      selectedWorkspaceId: 'D:\\workspaces\\demo',
      items: [
        createExpectedItem({
          workspaceId: 'D:\\workspaces\\demo',
          recordRef: 'workspace-record-1',
          name: 'Demo',
          cwd: 'D:\\workspaces\\demo',
          selected: true,
          operations: ['rename', 'edit-cwd'],
        }),
      ],
    }));
  });

  test('enters memory empty list when registry is unreadable', async () => {
    const fixture = createWorkspaceFixture({ readFailure: true });

    const list = await fixture.service.openList({ selectedWorkspaceId: null });

    assert.deepEqual(list, createExpectedList({
      persistence: { status: 'memory', warning: '当前 Workspace 变更不会持久保存', error: { code: 'registry-unreadable', message: 'Workspace 配置不可读' } },
      items: [],
    }));
  });

  test('enters memory mode for corrupted registry without overwriting corrupted content', async () => {
    const fixture = createWorkspaceFixture({ rawDocument: '{not json' });

    const list = await fixture.service.openList({ selectedWorkspaceId: null });

    assert.deepEqual(list, createExpectedList({
      persistence: { status: 'memory', warning: '当前 Workspace 变更不会持久保存', error: { code: 'registry-corrupted', message: 'Workspace 配置文件损坏' } },
      items: [],
    }));
    assert.deepEqual(fixture.appData.writes, []);
    assert.equal(fixture.appData.readRawDocument(), '{not json');
  });

  test('does not overwrite corrupted registry when add is the first workspace action', async () => {
    const fixture = createWorkspaceFixture({
      rawDocument: '{not json',
      paths: {
        'D:\\workspaces\\demo': createAvailablePath('D:\\workspaces\\demo', 'demo'),
      },
    });

    const list = await fixture.service.add({
      cwd: 'D:\\workspaces\\demo',
      name: 'Demo',
      selectedWorkspaceId: null,
    });

    assert.deepEqual(list, createExpectedList({
      persistence: { status: 'memory', warning: '当前 Workspace 变更不会持久保存', error: { code: 'registry-corrupted', message: 'Workspace 配置文件损坏' } },
      items: [
        createExpectedItem({ workspaceId: 'D:\\workspaces\\demo', recordRef: 'workspace-record-1', name: 'Demo', cwd: 'D:\\workspaces\\demo' }),
      ],
    }));
    assert.deepEqual(fixture.appData.writes, []);
    assert.equal(fixture.appData.readRawDocument(), '{not json');
  });

  test('does not write after unreadable registry when mutation is called first', async () => {
    const fixture = createWorkspaceFixture({
      readFailure: true,
      paths: {
        'D:\\workspaces\\demo': createAvailablePath('D:\\workspaces\\demo', 'demo'),
      },
    });

    const list = await fixture.service.add({
      cwd: 'D:\\workspaces\\demo',
      name: 'Demo',
      selectedWorkspaceId: null,
    });

    assert.deepEqual(list, createExpectedList({
      persistence: { status: 'memory', warning: '当前 Workspace 变更不会持久保存', error: { code: 'registry-unreadable', message: 'Workspace 配置不可读' } },
      items: [
        createExpectedItem({ workspaceId: 'D:\\workspaces\\demo', recordRef: 'workspace-record-1', name: 'Demo', cwd: 'D:\\workspaces\\demo' }),
      ],
    }));
    assert.deepEqual(fixture.appData.writes, []);
  });

  test('keeps user mutation in memory mode when persistent write fails', async () => {
    const fixture = createWorkspaceFixture({
      writeFailure: true,
      paths: {
        'D:\\workspaces\\demo': createAvailablePath('D:\\workspaces\\demo', 'demo'),
      },
    });

    const list = await fixture.service.add({
      cwd: 'D:\\workspaces\\demo',
      name: 'Demo',
      selectedWorkspaceId: null,
    });

    assert.deepEqual(list, createExpectedList({
      persistence: { status: 'memory', warning: '当前 Workspace 变更不会持久保存', error: { code: 'write-failed', message: 'Workspace 配置不可写' } },
      items: [
        createExpectedItem({ workspaceId: 'D:\\workspaces\\demo', recordRef: 'workspace-record-1', name: 'Demo', cwd: 'D:\\workspaces\\demo' }),
      ],
    }));

    assert.deepEqual(await fixture.service.openList({ selectedWorkspaceId: null }), list);
  });

  test('does not attempt later writes after entering memory mode', async () => {
    const fixture = createWorkspaceFixture({
      writeFailure: true,
      paths: {
        'D:\\workspaces\\demo': createAvailablePath('D:\\workspaces\\demo', 'demo'),
      },
    });

    await fixture.service.add({ cwd: 'D:\\workspaces\\demo', name: 'Demo', selectedWorkspaceId: null });
    const writesAfterFailure = fixture.appData.writes.length;

    await fixture.service.rename({
      recordRef: 'workspace-record-1',
      currentWorkspaceId: 'D:\\workspaces\\demo',
      name: 'Renamed',
      selectedWorkspaceId: null,
    });
    await fixture.service.remove({
      recordRef: 'workspace-record-1',
      currentWorkspaceId: 'D:\\workspaces\\demo',
      selectedWorkspaceId: null,
    });

    assert.equal(fixture.appData.writes.length, writesAfterFailure);
  });

  test('persistent mutations read the latest registry and preserve different workspace changes', async () => {
    const appData = createMemoryAppDataStore({ registry: createRegistry([]) });
    const paths = createTablePathInspection({
      'D:\\workspaces\\one': createAvailablePath('D:\\workspaces\\one', 'one'),
      'D:\\workspaces\\two': createAvailablePath('D:\\workspaces\\two', 'two'),
    }, {});
    const serviceA = createServiceWithSharedAdapters({ appData, paths, firstId: 1 });
    const serviceB = createServiceWithSharedAdapters({ appData, paths, firstId: 2 });

    await serviceA.add({ cwd: 'D:\\workspaces\\one', name: 'One', selectedWorkspaceId: null });
    const list = await serviceB.add({ cwd: 'D:\\workspaces\\two', name: 'Two', selectedWorkspaceId: null });

    assert.deepEqual(list, createExpectedList({
      items: [
        createExpectedItem({ workspaceId: 'D:\\workspaces\\one', recordRef: 'workspace-record-1', name: 'One', cwd: 'D:\\workspaces\\one' }),
        createExpectedItem({ workspaceId: 'D:\\workspaces\\two', recordRef: 'workspace-record-2', name: 'Two', cwd: 'D:\\workspaces\\two' }),
      ],
    }));
  });

  test('same workspace concurrent mutation is last write wins', async () => {
    const appData = createMemoryAppDataStore({
      registry: createRegistry([
        createRecord({ id: 'workspace-record-1', cwd: 'D:\\workspaces\\demo', name: 'Demo' }),
      ]),
    });
    const paths = createTablePathInspection({
      'D:\\workspaces\\demo': createAvailablePath('D:\\workspaces\\demo', 'demo'),
    }, {});
    const serviceA = createServiceWithSharedAdapters({ appData, paths, firstId: 2 });
    const serviceB = createServiceWithSharedAdapters({ appData, paths, firstId: 3 });

    await serviceA.rename({ recordRef: 'workspace-record-1', currentWorkspaceId: 'D:\\workspaces\\demo', name: 'First rename', selectedWorkspaceId: null });
    const list = await serviceB.rename({ recordRef: 'workspace-record-1', currentWorkspaceId: 'D:\\workspaces\\demo', name: 'Second rename', selectedWorkspaceId: null });

    assert.deepEqual(list, createExpectedList({
      items: [
        createExpectedItem({ workspaceId: 'D:\\workspaces\\demo', recordRef: 'workspace-record-1', name: 'Second rename', cwd: 'D:\\workspaces\\demo' }),
      ],
    }));
  });
});

interface WorkspaceFixtureOptions {
  readonly registry?: WorkspaceRegistry;
  readonly rawDocument?: string;
  readonly paths?: Record<string, TestAvailablePath>;
  readonly invalidPaths?: Record<string, TestInvalidPath>;
  readonly readFailure?: boolean;
  readonly writeFailure?: boolean;
  readonly pathComparison?: PathComparisonPort;
}

interface TestAvailablePath {
  readonly canonicalPath: string;
  readonly basename: string;
}

interface TestInvalidPath {
  readonly reason: 'empty' | 'relative' | 'missing' | 'not-directory' | 'inaccessible' | 'canonicalization-failed';
  readonly message: string;
}

interface AssertAddValidationFailureInput {
  readonly cwd: string;
  readonly code: TestInvalidPath['reason'];
  readonly message: string;
}

async function assertAddValidationFailure(input: AssertAddValidationFailureInput): Promise<void> {
  const fixture = createWorkspaceFixture({
    invalidPaths: {
      [input.cwd.trim()]: createInvalidPath(input.code, input.message),
    },
  });

  await assert.rejects(fixture.service.add({ cwd: input.cwd, name: 'Invalid', selectedWorkspaceId: null }), {
    name: 'WorkspaceValidationError',
    code: input.code,
  });
}

interface CreateFixtureWithExistingWorkspaceInput {
  readonly invalidPaths?: Record<string, TestInvalidPath>;
}

function createFixtureWithExistingWorkspace(input: CreateFixtureWithExistingWorkspaceInput = {}) {
  return createWorkspaceFixture({
    registry: createRegistry([
      createRecord({ id: 'workspace-record-1', cwd: 'D:\\workspaces\\existing', name: 'Existing' }),
    ]),
    paths: {
      'D:\\workspaces\\existing': createAvailablePath('D:\\workspaces\\existing', 'existing'),
    },
    invalidPaths: input.invalidPaths,
  });
}

interface CreateTwoWorkspaceFixtureInput {
  readonly invalidPaths?: Record<string, TestInvalidPath>;
}

function createTwoWorkspaceFixture(input: CreateTwoWorkspaceFixtureInput = {}) {
  return createWorkspaceFixture({
    registry: createRegistry([
      createRecord({ id: 'workspace-record-1', cwd: 'D:\\workspaces\\one', name: 'One' }),
      createRecord({ id: 'workspace-record-2', cwd: 'D:\\workspaces\\two', name: 'Two' }),
    ]),
    paths: {
      'D:\\workspaces\\one': createAvailablePath('D:\\workspaces\\one', 'one'),
      'D:\\workspaces\\two': createAvailablePath('D:\\workspaces\\two', 'two'),
    },
    invalidPaths: input.invalidPaths,
  });
}

function createAvailableAndUnavailableRemoveFixture() {
  return createWorkspaceFixture({
    registry: createRegistry([
      createRecord({ id: 'workspace-record-1', cwd: 'D:\\workspaces\\available', name: 'Available' }),
      createRecord({ id: 'workspace-record-2', cwd: 'D:\\workspaces\\missing', name: 'Missing' }),
    ]),
    paths: {
      'D:\\workspaces\\available': createAvailablePath('D:\\workspaces\\available', 'available'),
    },
    invalidPaths: {
      'D:\\workspaces\\missing': createInvalidPath('missing', '路径不存在'),
    },
  });
}

function createWorkspaceFixture(options: WorkspaceFixtureOptions = {}) {
  const appData = createMemoryAppDataStore(options);
  const paths = createTablePathInspection(options.paths ?? {}, options.invalidPaths ?? {});

  return {
    appData,
    paths,
    service: createServiceWithSharedAdapters({ appData, paths, pathComparison: options.pathComparison, firstId: 1 }),
  };
}

interface CreateServiceWithSharedAdaptersInput {
  readonly appData: TestAppDataStore;
  readonly paths: TestPathInspection;
  readonly pathComparison?: PathComparisonPort;
  readonly firstId: number;
}

function createServiceWithSharedAdapters(input: CreateServiceWithSharedAdaptersInput): WorkspaceService {
  const clock: ClockPort = {
    now() {
      return '2026-05-04T00:00:00.000Z';
    },
  };
  let nextId = input.firstId;
  const ids: IdPort = {
    createId() {
      const id = `workspace-record-${nextId}`;
      nextId += 1;
      return id;
    },
  };

  return createWorkspaceService({
    appData: input.appData,
    paths: input.paths,
    pathComparison: input.pathComparison ?? createCaseInsensitivePathComparison(),
    clock,
    ids,
  });

}

function createCaseInsensitivePathComparison(): PathComparisonPort {
  return {
    samePath(input) {
      return input.left.toLowerCase() === input.right.toLowerCase();
    },
  };
}

type TestAppDataStore = AppDataStorePort & {
  readonly writes: readonly string[];
  readRawDocument(): string | null;
};

function createMemoryAppDataStore(options: WorkspaceFixtureOptions): TestAppDataStore {
  let document = readInitialDocument(options);
  const writes: string[] = [];

  return {
    writes,
    readRawDocument() {
      return document;
    },
    async readDocument() {
      if (options.readFailure) {
        throw new Error('read failed');
      }

      return document;
    },
    async writeDocumentAtomically(input) {
      writes.push(input.content);
      if (options.writeFailure) {
        throw new Error('write failed');
      }
      document = input.content;
    },
  };
}

function readInitialDocument(options: WorkspaceFixtureOptions): string | null {
  if (options.rawDocument !== undefined) {
    return options.rawDocument;
  }

  if (options.registry === undefined) {
    return null;
  }

  return JSON.stringify(options.registry);
}

type TestPathInspection = PathInspectionPort & {
  setAvailable(path: string, result: TestAvailablePath): void;
};

function createTablePathInspection(paths: Record<string, TestAvailablePath>, invalidPaths: Record<string, TestInvalidPath>): TestPathInspection {
  const available = new Map(Object.entries(paths));
  const invalid = new Map(Object.entries(invalidPaths));

  return {
    setAvailable(path, result) {
      invalid.delete(path);
      available.set(path, result);
    },
    async inspect(input) {
      const result = available.get(input.path);
      if (result) {
        return {
          status: 'available',
          canonicalPath: result.canonicalPath,
          basename: result.basename,
        };
      }

      const invalidResult = invalid.get(input.path) ?? createInvalidPath('missing', '路径不存在');
      return {
        status: 'invalid',
        reason: invalidResult.reason,
        message: invalidResult.message,
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
  readonly createdAt?: string;
}

function createRecord(input: CreateRecordInput) {
  return {
    id: input.id,
    cwd: input.cwd,
    name: input.name,
    createdAt: input.createdAt ?? '2026-05-04T00:00:00.000Z',
  };
}

function createRegistry(workspaces: WorkspaceRegistry['workspaces']): WorkspaceRegistry {
  return {
    version: 1,
    workspaces,
  };
}

interface CreateExpectedListInput {
  readonly persistence?: WorkspaceListSnapshot['persistence'];
  readonly selectedWorkspaceId?: string | null;
  readonly items: WorkspaceListSnapshot['items'];
}

function createExpectedList(input: CreateExpectedListInput): WorkspaceListSnapshot {
  return {
    persistence: input.persistence ?? { status: 'persistent' },
    selectedWorkspaceId: input.selectedWorkspaceId ?? null,
    items: input.items,
  };
}

interface CreateExpectedItemInput {
  readonly workspaceId: string;
  readonly recordRef: string;
  readonly name: string;
  readonly cwd: string;
  readonly availability?: WorkspaceListSnapshot['items'][number]['availability'];
  readonly selected?: boolean;
  readonly operations?: WorkspaceListSnapshot['items'][number]['operations'];
}

function createExpectedItem(input: CreateExpectedItemInput): WorkspaceListSnapshot['items'][number] {
  return {
    workspaceId: input.workspaceId,
    recordRef: input.recordRef,
    name: input.name,
    cwd: input.cwd,
    availability: input.availability ?? { status: 'available' },
    selected: input.selected ?? false,
    operations: input.operations ?? ['rename', 'edit-cwd', 'remove'],
  };
}
