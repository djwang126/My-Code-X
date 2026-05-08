import { stat, writeFile } from 'node:fs/promises';
import { detectWorkspaceFileContentKind } from './workspace-file-detection.js';
import { createWorkspaceNotTextFileError } from './workspace-errors.js';
import { resolveWorkspaceFileTarget } from './workspace-paths.js';
export async function saveWorkspaceFile({ content, path, workspace, }) {
    const { relativePath, target } = await resolveWorkspaceFileTarget({ workspace, path });
    const contentKind = await detectWorkspaceFileContentKind(target, relativePath);
    if (contentKind !== 'text') {
        throw createWorkspaceNotTextFileError();
    }
    await writeFile(target, String(content ?? ''), 'utf8');
    const savedStats = await stat(target);
    return {
        ok: true,
        path: relativePath,
        size: savedStats.size,
        updatedAt: savedStats.mtime.toISOString(),
    };
}
//# sourceMappingURL=workspace-save-file.js.map