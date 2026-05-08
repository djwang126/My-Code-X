import { normalize, resolve } from 'node:path';
import { realpath, stat } from 'node:fs/promises';
import { createWorkspaceNotFoundError, createWorkspaceOutsideBoundaryError, createWorkspacePathRequiredError, createWorkspaceRequiredError, } from './workspace-errors.js';
export function normalizeRelativePath(path) {
    const normalized = normalize(String(path || '').trim()).replace(/\\/g, '/');
    if (!normalized || normalized === '.') {
        return '';
    }
    return normalized.replace(/^\.\/+/, '');
}
function normalizePathForComparison(path) {
    const normalized = resolve(path).replace(/\\/g, '/').replace(/\/+$/, '');
    return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}
export function isTargetWithinWorkspace(workspace, target) {
    const normalizedWorkspace = normalizePathForComparison(workspace);
    const normalizedTarget = normalizePathForComparison(target);
    return normalizedTarget === normalizedWorkspace || normalizedTarget.startsWith(`${normalizedWorkspace}/`);
}
export function assertTargetWithinWorkspace(workspace, target) {
    if (!isTargetWithinWorkspace(workspace, target)) {
        throw createWorkspaceOutsideBoundaryError();
    }
}
export function resolveWorkspaceTarget({ workspace, path = '', }) {
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
export async function statWorkspaceTarget(target) {
    try {
        return await stat(target);
    }
    catch (error) {
        const resolvedError = error;
        if (resolvedError.code === 'ENOENT') {
            throw createWorkspaceNotFoundError();
        }
        throw error;
    }
}
export async function realpathWorkspaceTarget(target) {
    try {
        return await realpath(target);
    }
    catch (error) {
        const resolvedError = error;
        if (resolvedError.code === 'ENOENT') {
            throw createWorkspaceNotFoundError();
        }
        throw error;
    }
}
export async function resolveWorkspaceFileTarget({ workspace, path, }) {
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
//# sourceMappingURL=workspace-paths.js.map