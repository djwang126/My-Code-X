import { basename, extname, normalize, resolve } from 'node:path';
import { readdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import type { Dirent, Stats } from 'node:fs';
import { createHttpError } from '../../common/errors/http-error.js';
type ErrnoError = Error & { code?: string };
const MAX_EDITABLE_BYTES = 256 * 1024;
const EDITABLE_EXTENSIONS = new Set(['.md', '.txt', '.json', '.yml', '.yaml', '.toml', '.ini', '.env']);
const EDITABLE_BASENAMES = new Set([
    'dockerfile',
    '.gitignore',
    '.editorconfig',
    '.npmrc',
    '.prettierrc',
    '.eslintrc',
    '.eslintignore',
]);
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
    isTextEditable: boolean;
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
function isTextEditablePath(path: string) {
    const name = basename(path).toLowerCase();
    const extension = extname(name);
    return EDITABLE_EXTENSIONS.has(extension) || EDITABLE_BASENAMES.has(name) || name === '.env' || name.startsWith('.env.');
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
function resolveWorkspaceTarget({ workspace, path = '' }: {
    workspace: string;
    path?: string;
}): ResolvedWorkspaceTarget {
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
    }
    catch (error) {
        const resolvedError = error as ErrnoError;
        if (resolvedError?.code === 'ENOENT') {
            throw createHttpError('not_found', 404);
        }
        throw error;
    }
}
async function realpathWorkspaceTarget(target: string): Promise<string> {
    try {
        return await realpath(target);
    }
    catch (error) {
        const resolvedError = error as ErrnoError;
        if (resolvedError?.code === 'ENOENT') {
            throw createHttpError('not_found', 404);
        }
        throw error;
    }
}
function assertTargetWithinWorkspace(workspace: string, target: string) {
    if (!isTargetWithinWorkspace(workspace, target)) {
        throw createHttpError('outside_workspace', 403);
    }
}
async function tryResolveRealChildTarget(childTarget: string): Promise<string | null> {
    try {
        return await realpathWorkspaceTarget(childTarget);
    }
    catch (error) {
        const resolvedError = error as Error;
        if (resolvedError?.message === 'not_found') {
            return null;
        }
        throw error;
    }
}
async function tryReadChildStats(realChildTarget: string): Promise<Stats | null> {
    try {
        return await statWorkspaceTarget(realChildTarget);
    }
    catch (error) {
        const resolvedError = error as Error;
        if (resolvedError?.message === 'not_found') {
            return null;
        }
        throw error;
    }
}
async function createListEntry(entry: Dirent, { relativePath, target, realWorkspace }: {
    relativePath: string;
    target: string;
    realWorkspace: string;
}): Promise<WorkspaceListEntry | null> {
    const childRelativePath = normalizeRelativePath(relativePath ? `${relativePath}/${entry.name}` : entry.name);
    const childTarget = resolve(target, entry.name);
    const realChildTarget = await tryResolveRealChildTarget(childTarget);
    if (!realChildTarget) {
        return null;
    }
    try {
        assertTargetWithinWorkspace(realWorkspace, realChildTarget);
    }
    catch (error) {
        const resolvedError = error as Error;
        if (resolvedError?.message === 'outside_workspace') {
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
    return {
        path: childRelativePath,
        name: entry.name,
        kind: isDirectory ? 'directory' : 'file',
        size: isDirectory ? 0 : childStats.size,
        ext: isDirectory ? '' : extname(entry.name).toLowerCase(),
        isTextEditable: isDirectory ? false : isTextEditablePath(entry.name),
    };
}
export function createWorkspaceFilesService() {
    return {
        async listFiles({ workspace, path = '' }: any) {
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
            return data
                .filter((entry: any): entry is WorkspaceListEntry => entry !== null)
                .sort(compareWorkspaceListEntries);
        },
        async readFile({ workspace, path }: {
            workspace: string;
            path: string;
        }) {
            const { workspace: resolvedWorkspace, target, relativePath } = resolveWorkspaceTarget({ workspace, path });
            if (!relativePath) {
                throw createHttpError('path is required', 400);
            }
            const targetStats = await statWorkspaceTarget(target);
            if (!targetStats.isFile()) {
                throw createHttpError('not_found', 404);
            }
            const isTextEditable = isTextEditablePath(relativePath);
            if (!isTextEditable) {
                throw createHttpError('not_text_editable', 415);
            }
            const realWorkspace = await realpathWorkspaceTarget(resolvedWorkspace);
            const realTarget = await realpathWorkspaceTarget(target);
            assertTargetWithinWorkspace(realWorkspace, realTarget);
            const tooLarge = targetStats.size > MAX_EDITABLE_BYTES;
            const content = tooLarge ? '' : await readFile(target, 'utf8');
            return {
                path: relativePath,
                name: basename(relativePath),
                size: targetStats.size,
                encoding: 'utf-8',
                content,
                isTextEditable,
                tooLarge,
            };
        },
        async saveFile({ workspace, path, content }: {
            workspace: string;
            path: string;
            content: string;
        }) {
            const { workspace: resolvedWorkspace, target, relativePath } = resolveWorkspaceTarget({ workspace, path });
            if (!relativePath) {
                throw createHttpError('path is required', 400);
            }
            const targetStats = await statWorkspaceTarget(target);
            if (!targetStats.isFile()) {
                throw createHttpError('not_found', 404);
            }
            if (!isTextEditablePath(relativePath)) {
                throw createHttpError('not_text_editable', 415);
            }
            const nextContent = String(content ?? '');
            const nextSize = Buffer.byteLength(nextContent, 'utf8');
            if (nextSize > MAX_EDITABLE_BYTES) {
                throw createHttpError('too_large', 413);
            }
            const realWorkspace = await realpathWorkspaceTarget(resolvedWorkspace);
            const realTarget = await realpathWorkspaceTarget(target);
            assertTargetWithinWorkspace(realWorkspace, realTarget);
            await writeFile(target, nextContent, 'utf8');
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
