import { listSystemProcesses, pruneDescendantRootPids, terminateProcessTree } from '../my-code-x-process-tree.mjs';

function normalizeForMatch(value) {
  return String(value || '')
    .trim()
    .replaceAll('\\', '/')
    .toLowerCase();
}

function isOwnedLauncherProcess(processRecord, repoRoot) {
  const commandLine = normalizeForMatch(processRecord.commandLine);
  if (!commandLine.includes(repoRoot)) {
    return false;
  }

  return (
    commandLine.includes('scripts/my-code-x-supervisor.mjs run') ||
    commandLine.includes('apps/server/dist/app/index.js')
  );
}

export function findLauncherOwnedRootPids({ processes, repoRoot }) {
  const normalizedRepoRoot = normalizeForMatch(repoRoot);
  const ownedProcesses = processes.filter(processRecord => isOwnedLauncherProcess(processRecord, normalizedRepoRoot));
  return pruneDescendantRootPids(processes, ownedProcesses.map(processRecord => processRecord.pid));
}

export async function findLauncherOwnedProcessRoots({ repoRoot, listSystemProcessesImpl = listSystemProcesses }) {
  const processes = await listSystemProcessesImpl();
  const rootPids = findLauncherOwnedRootPids({ processes, repoRoot });

  return processes.filter(processRecord => rootPids.includes(processRecord.pid));
}

export async function stopLauncherOwnedProcessRoots({
  repoRoot,
  listSystemProcessesImpl = listSystemProcesses,
  terminateProcessTreeImpl = terminateProcessTree,
}) {
  const roots = await findLauncherOwnedProcessRoots({ repoRoot, listSystemProcessesImpl });

  for (const root of roots) {
    await terminateProcessTreeImpl(root.pid);
  }

  return {
    stoppedRootPids: roots.map(root => root.pid),
  };
}
