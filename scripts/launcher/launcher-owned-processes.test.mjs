import test from 'node:test';
import assert from 'node:assert/strict';

import { findLauncherOwnedRootPids, stopLauncherOwnedProcessRoots } from './launcher-owned-processes.mjs';

const repoRoot = 'D:/workspaces/AI-Tools/My-Code-X';

test('findLauncherOwnedRootPids only returns launcher roots from the same repo', () => {
  const processes = [
    {
      pid: 100,
      ppid: 1,
      commandLine: 'node D:/workspaces/AI-Tools/My-Code-X/scripts/my-code-x-supervisor.mjs run',
    },
    {
      pid: 101,
      ppid: 100,
      commandLine: 'node D:/workspaces/AI-Tools/My-Code-X/apps/server/dist/app/index.js',
    },
    {
      pid: 200,
      ppid: 1,
      commandLine: 'node D:/workspaces/AI-Tools/My-Code-X/apps/server/dist/app/index.js',
    },
    {
      pid: 300,
      ppid: 1,
      commandLine: 'node D:/other-repo/apps/server/dist/app/index.js',
    },
    {
      pid: 400,
      ppid: 1,
      commandLine: 'node D:/workspaces/AI-Tools/My-Code-X/scripts/something-else.mjs',
    },
  ];

  assert.deepEqual(findLauncherOwnedRootPids({ processes, repoRoot }), [100, 200]);
});

test('stopLauncherOwnedProcessRoots terminates every discovered launcher root pid', async () => {
  const terminatedPids = [];
  const processes = [
    {
      pid: 100,
      ppid: 1,
      commandLine: 'node D:/workspaces/AI-Tools/My-Code-X/scripts/my-code-x-supervisor.mjs run',
    },
    {
      pid: 101,
      ppid: 100,
      commandLine: 'node D:/workspaces/AI-Tools/My-Code-X/apps/server/dist/app/index.js',
    },
    {
      pid: 200,
      ppid: 1,
      commandLine: 'node D:/workspaces/AI-Tools/My-Code-X/apps/server/dist/app/index.js',
    },
  ];

  const result = await stopLauncherOwnedProcessRoots({
    repoRoot,
    listSystemProcessesImpl: async () => processes,
    terminateProcessTreeImpl: async pid => {
      terminatedPids.push(pid);
    },
  });

  assert.deepEqual(terminatedPids, [100, 200]);
  assert.deepEqual(result, {
    stoppedRootPids: [100, 200],
  });
});
