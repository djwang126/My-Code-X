import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Dirent, Stats } from 'node:fs';
import type { WorkspaceFileEntry } from '@my-code-x/contracts';

import {
  detectWorkspaceFileContentKind,
  MAX_WORKSPACE_TEXT_PREVIEW_BYTES,
} from './workspace-file-detection.js';
import {
  createWorkspaceDirectoryEntry,
  createWorkspaceListedFileEntry,
} from './workspace-file-presenters.js';
import {
  createWorkspaceNotFoundError,
  isWorkspaceErrorCode,
} from './workspace-errors.js';
import {
  assertTargetWithinWorkspace,
  realpathWorkspaceTarget,
  resolveWorkspaceTarget,
  statWorkspaceTarget,
  normalizeRelativePath,
} from './workspace-paths.js';

function compareWorkspaceListEntries(left: WorkspaceFileEntry, right: WorkspaceFileEntry) {
  if (left.kind !== right.kind) {
    return left.kind === 'directory' ? -1 : 1;
  }

  return left.name.localeCompare(right.name);
}

async function tryResolveRealChildTarget(childTarget: string) {
  try {
    return await realpathWorkspaceTarget(childTarget);
  } catch (error) {
    if (isWorkspaceErrorCode(error, 'not_found')) {
      return null;
    }

    throw error;
  }
}

async function tryReadChildStats(realChildTarget: string): Promise<Stats | null> {
  try {
    return await statWorkspaceTarget(realChildTarget);
  } catch (error) {
    if (isWorkspaceErrorCode(error, 'not_found')) {
      return null;
    }

    throw error;
  }
}

async function createWorkspaceListEntry({
  entry,
  realWorkspace,
  relativePath,
  target,
}: {
  entry: Dirent;
  realWorkspace: string;
  relativePath: string;
  target: string;
}): Promise<WorkspaceFileEntry | null> {
  const childRelativePath = normalizeRelativePath(relativePath ? `${relativePath}/${entry.name}` : entry.name);
  const childTarget = resolve(target, entry.name);
  const realChildTarget = await tryResolveRealChildTarget(childTarget);
  if (!realChildTarget) {
    return null;
  }

  try {
    assertTargetWithinWorkspace(realWorkspace, realChildTarget);
  } catch (error) {
    if (isWorkspaceErrorCode(error, 'outside_workspace')) {
      return null;
    }

    throw error;
  }

  const childStats = await tryReadChildStats(realChildTarget);
  if (!childStats) {
    return null;
  }

  if (childStats.isDirectory()) {
    return createWorkspaceDirectoryEntry({
      path: childRelativePath,
      name: entry.name,
    });
  }

  if (!childStats.isFile()) {
    return null;
  }

  const contentKind = await detectWorkspaceFileContentKind(realChildTarget, entry.name);
  return createWorkspaceListedFileEntry({
    contentKind,
    isLarge: childStats.size > MAX_WORKSPACE_TEXT_PREVIEW_BYTES,
    name: entry.name,
    path: childRelativePath,
    size: childStats.size,
  });
}

export async function listWorkspaceFiles({
  path = '',
  workspace,
}: {
  path?: string;
  workspace: string;
}) {
  const { workspace: resolvedWorkspace, target, relativePath } = resolveWorkspaceTarget({ workspace, path });
  const targetStats = await statWorkspaceTarget(target);
  if (!targetStats.isDirectory()) {
    throw createWorkspaceNotFoundError();
  }

  const realWorkspace = await realpathWorkspaceTarget(resolvedWorkspace);
  const realTarget = await realpathWorkspaceTarget(target);
  assertTargetWithinWorkspace(realWorkspace, realTarget);

  const entries = await readdir(target, { withFileTypes: true });
  const data = await Promise.all(
    entries.map(entry =>
      createWorkspaceListEntry({
        entry,
        realWorkspace,
        relativePath,
        target,
      }),
    ),
  );

  return data.filter((entry): entry is WorkspaceFileEntry => entry !== null).sort(compareWorkspaceListEntries);
}
