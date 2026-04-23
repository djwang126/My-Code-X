import { basename, extname, normalize, resolve } from 'node:path';
import { readdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import type { Dirent, Stats } from 'node:fs';

import { createHttpError } from '../../common/errors/http-error.js';
import {
  detectWorkspaceFileContentKind,
  getWorkspaceImageContentType,
  MAX_WORKSPACE_TEXT_PREVIEW_BYTES,
  readWorkspaceTextFile,
} from './workspace-file-detection.js';

type ErrnoError = Error & { code?: string };

interface ResolvedWorkspaceTarget {
  workspace: string;
  target: string;
  relativePath: string;
}

interface WorkspaceListEntry {
  path: string;
  name: string;
  kind: 'directory' | 'file';
  size: number;
  ext: string;
  contentKind: 'text' | 'image' | 'binary' | null;
  isLarge: boolean;
}

function compareWorkspaceListEntries(left: WorkspaceListEntry, right: WorkspaceListEntry) {
  if (left.kind !== right.kind) {
    return left.kind === 'directory' ? -1 : 1;
  }

  return left.name.localeCompare(right.name);
}

function normalizeRelativePath(path: string) {
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

function isTargetWithinWorkspace(workspace: string, target: string) {
  const normalizedWorkspace = normalizePathForComparison(workspace);
  const normalizedTarget = normalizePathForComparison(target);
  return normalizedTarget === normalizedWorkspace || normalizedTarget.startsWith(`${normalizedWorkspace}/`);
}

function assertTargetWithinWorkspace(workspace: string, target: string) {
  if (!isTargetWithinWorkspace(workspace, target)) {
    throw createHttpError('outside_workspace', 403);
  }
}

function buildWorkspaceFileContentUrl({ workspace, path }: { workspace: string; path: string }) {
  const search = new URLSearchParams({ workspace, path });
  return `/api/v2/workspace/file/content?${search.toString()}`;
}

function resolveWorkspaceTarget({ workspace, path = '' }: { workspace: string; path?: string }): ResolvedWorkspaceTarget {
  const normalizedWorkspace = String(workspace || '').trim();
  if (!normalizedWorkspace) {
    throw createHttpError('workspace is required', 400);
  }

  const rawPath = String(path || '').trim();
  if (rawPath && (rawPath.startsWith('/') || rawPath.startsWith('\\') || /^[A-Za-z]:/.test(rawPath))) {
    throw createHttpError('outside_workspace', 403);
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

async function statWorkspaceTarget(target: string): Promise<Stats> {
  try {
    return await stat(target);
  } catch (error) {
    const resolvedError = error as ErrnoError;
    if (resolvedError.code === 'ENOENT') {
      throw createHttpError('not_found', 404);
    }

    throw error;
  }
}

async function realpathWorkspaceTarget(target: string) {
  try {
    return await realpath(target);
  } catch (error) {
    const resolvedError = error as ErrnoError;
    if (resolvedError.code === 'ENOENT') {
      throw createHttpError('not_found', 404);
    }

    throw error;
  }
}

async function tryResolveRealChildTarget(childTarget: string) {
  try {
    return await realpathWorkspaceTarget(childTarget);
  } catch (error) {
    if ((error as Error).message === 'not_found') {
      return null;
    }

    throw error;
  }
}

async function tryReadChildStats(realChildTarget: string) {
  try {
    return await statWorkspaceTarget(realChildTarget);
  } catch (error) {
    if ((error as Error).message === 'not_found') {
      return null;
    }

    throw error;
  }
}

async function createListEntry(
  entry: Dirent,
  {
    relativePath,
    target,
    realWorkspace,
  }: {
    relativePath: string;
    target: string;
    realWorkspace: string;
  },
): Promise<WorkspaceListEntry | null> {
  const childRelativePath = normalizeRelativePath(relativePath ? `${relativePath}/${entry.name}` : entry.name);
  const childTarget = resolve(target, entry.name);
  const realChildTarget = await tryResolveRealChildTarget(childTarget);
  if (!realChildTarget) {
    return null;
  }

  try {
    assertTargetWithinWorkspace(realWorkspace, realChildTarget);
  } catch (error) {
    if ((error as Error).message === 'outside_workspace') {
      return null;
    }

    throw error;
  }

  const childStats = await tryReadChildStats(realChildTarget);
  if (!childStats) {
    return null;
  }

  const isDirectory = childStats.isDirectory();
  const isFile = childStats.isFile();
  if (!isDirectory && !isFile) {
    return null;
  }

  const contentKind = isDirectory ? null : await detectWorkspaceFileContentKind(realChildTarget, entry.name);

  return {
    path: childRelativePath,
    name: entry.name,
    kind: isDirectory ? 'directory' : 'file',
    size: isDirectory ? 0 : childStats.size,
    ext: isDirectory ? '' : extname(entry.name).toLowerCase(),
    contentKind,
    isLarge: isDirectory ? false : childStats.size > MAX_WORKSPACE_TEXT_PREVIEW_BYTES,
  };
}

async function resolveWorkspaceFileTarget({ workspace, path }: { workspace: string; path: string }) {
  const { workspace: resolvedWorkspace, target, relativePath } = resolveWorkspaceTarget({ workspace, path });
  if (!relativePath) {
    throw createHttpError('path is required', 400);
  }

  const targetStats = await statWorkspaceTarget(target);
  if (!targetStats.isFile()) {
    throw createHttpError('not_found', 404);
  }

  const realWorkspace = await realpathWorkspaceTarget(resolvedWorkspace);
  const realTarget = await realpathWorkspaceTarget(target);
  assertTargetWithinWorkspace(realWorkspace, realTarget);

  return {
    target,
    relativePath,
    targetStats,
    contentKind: await detectWorkspaceFileContentKind(realTarget, relativePath),
  };
}

export function createWorkspaceFilesService() {
  return {
    async listFiles({ workspace, path = '' }: { workspace: string; path?: string }) {
      const { workspace: resolvedWorkspace, target, relativePath } = resolveWorkspaceTarget({ workspace, path });
      const targetStats = await statWorkspaceTarget(target);
      if (!targetStats.isDirectory()) {
        throw createHttpError('not_found', 404);
      }

      const realWorkspace = await realpathWorkspaceTarget(resolvedWorkspace);
      const realTarget = await realpathWorkspaceTarget(target);
      assertTargetWithinWorkspace(realWorkspace, realTarget);

      const entries = await readdir(target, { withFileTypes: true });
      const data = await Promise.all(entries.map(entry => createListEntry(entry, { relativePath, target, realWorkspace })));

      return data.filter((entry): entry is WorkspaceListEntry => entry !== null).sort(compareWorkspaceListEntries);
    },

    async readFile({ workspace, path, full = false }: { workspace: string; path: string; full?: boolean }) {
      const { target, relativePath, targetStats, contentKind } = await resolveWorkspaceFileTarget({ workspace, path });

      if (contentKind === 'image') {
        const contentType = getWorkspaceImageContentType(relativePath);
        if (!contentType) {
          throw createHttpError('unsupported_image_type', 415);
        }

        return {
          kind: 'image' as const,
          path: relativePath,
          name: basename(relativePath),
          size: targetStats.size,
          contentType,
          url: buildWorkspaceFileContentUrl({ workspace, path: relativePath }),
        };
      }

      if (contentKind === 'binary') {
        return {
          kind: 'binary' as const,
          path: relativePath,
          name: basename(relativePath),
          size: targetStats.size,
          contentType: null,
        };
      }

      const textFile = await readWorkspaceTextFile({
        target,
        maxBytes: full ? null : MAX_WORKSPACE_TEXT_PREVIEW_BYTES,
      });
      if (!textFile) {
        throw createHttpError('not_text_file', 415);
      }

      return {
        kind: 'text' as const,
        path: relativePath,
        name: basename(relativePath),
        size: targetStats.size,
        encoding: 'utf-8' as const,
        content: textFile.content,
        truncated: textFile.truncated,
      };
    },

    async readFileContent({ workspace, path }: { workspace: string; path: string }) {
      const { target, contentKind } = await resolveWorkspaceFileTarget({ workspace, path });
      if (contentKind !== 'image') {
        throw createHttpError('not_image_file', 415);
      }

      const contentType = getWorkspaceImageContentType(path);
      if (!contentType) {
        throw createHttpError('unsupported_image_type', 415);
      }

      return {
        body: await readFile(target),
        contentType,
      };
    },

    async saveFile({ workspace, path, content }: { workspace: string; path: string; content: string }) {
      const { target, relativePath, contentKind } = await resolveWorkspaceFileTarget({ workspace, path });
      if (contentKind !== 'text') {
        throw createHttpError('not_text_file', 415);
      }

      await writeFile(target, String(content ?? ''), 'utf8');
      const savedStats = await stat(target);

      return {
        ok: true,
        path: relativePath,
        size: savedStats.size,
        updatedAt: savedStats.mtime.toISOString(),
      };
    },
  };
}
