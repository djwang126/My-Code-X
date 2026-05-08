import { normalize, resolve } from 'node:path';
import { realpath, stat } from 'node:fs/promises';
import type { Stats } from 'node:fs';

import {
  createWorkspaceNotFoundError,
  createWorkspaceOutsideBoundaryError,
  createWorkspacePathRequiredError,
  createWorkspaceRequiredError,
} from './workspace-errors.js';

type ErrnoError = Error & { code?: string };

export interface ResolvedWorkspaceTarget {
  workspace: string;
  target: string;
  relativePath: string;
}

export function normalizeRelativePath(path: string) {
  const normalized = normalize(String(path || '').trim()).replace(/\\/g, '/');
  if (!normalized || normalized === '.') {
    return '';
  }

  return normalized.replace(/^\.\/+/, '');
}

function normalizePathForComparison(path: string) {
  const normalized = resolve(path).replace(/\\/g, '/').replace(/\/+$/, '');
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

export function isTargetWithinWorkspace(workspace: string, target: string) {
  const normalizedWorkspace = normalizePathForComparison(workspace);
  const normalizedTarget = normalizePathForComparison(target);
  return normalizedTarget === normalizedWorkspace || normalizedTarget.startsWith(`${normalizedWorkspace}/`);
}

export function assertTargetWithinWorkspace(workspace: string, target: string) {
  if (!isTargetWithinWorkspace(workspace, target)) {
    throw createWorkspaceOutsideBoundaryError();
  }
}

export function resolveWorkspaceTarget({
  workspace,
  path = '',
}: {
  workspace: string;
  path?: string;
}): ResolvedWorkspaceTarget {
  const normalizedWorkspace = String(workspace || '').trim();
  if (!normalizedWorkspace) {
    throw createWorkspaceRequiredError();
  }

  const rawPath = String(path || '').trim();
  if (rawPath && (rawPath.startsWith('/') || rawPath.startsWith('\\') || /^[A-Za-z]:/.test(rawPath))) {
    throw createWorkspaceOutsideBoundaryError();
  }

  const resolvedWorkspace = resolve(normalizedWorkspace);
  const resolvedTarget = resolve(resolvedWorkspace, rawPath || '.');
  assertTargetWithinWorkspace(resolvedWorkspace, resolvedTarget);

  return {
    workspace: resolvedWorkspace,
    target: resolvedTarget,
    relativePath: normalizeRelativePath(rawPath),
  };
}

export async function statWorkspaceTarget(target: string): Promise<Stats> {
  try {
    return await stat(target);
  } catch (error) {
    const resolvedError = error as ErrnoError;
    if (resolvedError.code === 'ENOENT') {
      throw createWorkspaceNotFoundError();
    }

    throw error;
  }
}

export async function realpathWorkspaceTarget(target: string) {
  try {
    return await realpath(target);
  } catch (error) {
    const resolvedError = error as ErrnoError;
    if (resolvedError.code === 'ENOENT') {
      throw createWorkspaceNotFoundError();
    }

    throw error;
  }
}

export async function resolveWorkspaceFileTarget({
  workspace,
  path,
}: {
  workspace: string;
  path: string;
}) {
  const { workspace: resolvedWorkspace, target, relativePath } = resolveWorkspaceTarget({ workspace, path });
  if (!relativePath) {
    throw createWorkspacePathRequiredError();
  }

  const targetStats = await statWorkspaceTarget(target);
  if (!targetStats.isFile()) {
    throw createWorkspaceNotFoundError();
  }

  const realWorkspace = await realpathWorkspaceTarget(resolvedWorkspace);
  const realTarget = await realpathWorkspaceTarget(target);
  assertTargetWithinWorkspace(realWorkspace, realTarget);

  return {
    relativePath,
    target,
    targetStats,
  };
}
