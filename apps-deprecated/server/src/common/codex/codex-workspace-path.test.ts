import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCodexWorkspacePathStrategy } from './codex-workspace-path.js';

const isWindows = process.platform === 'win32';

test('workspace path strategy derives a plain execution cwd and ordered query candidates', () => {
  const workspace = 'D:/workspace/example-app-worktree';
  const strategy = buildCodexWorkspacePathStrategy(workspace);

  if (!isWindows) {
    assert.deepEqual(strategy, {
      canonicalCwd: workspace,
      executionCwd: workspace,
      queryCandidates: [workspace],
    });
    return;
  }

  assert.deepEqual(strategy, {
    canonicalCwd: 'D:\\workspace\\example-app-worktree',
    executionCwd: 'D:\\workspace\\example-app-worktree',
    queryCandidates: ['D:\\workspace\\example-app-worktree', '\\\\?\\D:\\workspace\\example-app-worktree'],
  });
});

test('workspace path strategy normalizes extended Windows input to one plain execution cwd and two query candidates', () => {
  const workspace = '\\\\?\\D:\\workspace\\example-app-worktree';
  const strategy = buildCodexWorkspacePathStrategy(workspace);

  if (!isWindows) {
    assert.deepEqual(strategy, {
      canonicalCwd: workspace,
      executionCwd: workspace,
      queryCandidates: [workspace],
    });
    return;
  }

  assert.deepEqual(strategy, {
    canonicalCwd: 'D:\\workspace\\example-app-worktree',
    executionCwd: 'D:\\workspace\\example-app-worktree',
    queryCandidates: ['D:\\workspace\\example-app-worktree', '\\\\?\\D:\\workspace\\example-app-worktree'],
  });
});

test('workspace path strategy uses the fallback only for execution resolution', () => {
  const fallbackWorkspace = 'D:/workspace/example-app-worktree';
  const strategy = buildCodexWorkspacePathStrategy('', fallbackWorkspace);

  if (!isWindows) {
    assert.deepEqual(strategy, {
      canonicalCwd: fallbackWorkspace,
      executionCwd: fallbackWorkspace,
      queryCandidates: [],
    });
    return;
  }

  assert.deepEqual(strategy, {
    canonicalCwd: 'D:\\workspace\\example-app-worktree',
    executionCwd: 'D:\\workspace\\example-app-worktree',
    queryCandidates: [],
  });
});
