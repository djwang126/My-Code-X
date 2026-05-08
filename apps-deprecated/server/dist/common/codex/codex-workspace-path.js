function trimWorkspace(workspace) {
    return String(workspace || '').trim();
}
function normalizeWindowsSlashes(workspace) {
    return trimWorkspace(workspace).replace(/\//g, '\\').replace(/\\+$/, '');
}
function stripWindowsExtendedPrefix(workspace) {
    if (/^\\\\\?\\UNC\\/.test(workspace)) {
        return `\\\\${workspace.slice('\\\\?\\UNC\\'.length)}`;
    }
    if (/^\\\\\?\\[A-Za-z]:\\/.test(workspace)) {
        return workspace.slice('\\\\?\\'.length);
    }
    return workspace;
}
function normalizePlainWindowsWorkspace(workspace) {
    return stripWindowsExtendedPrefix(normalizeWindowsSlashes(workspace));
}
function toExtendedWindowsWorkspace(workspace) {
    if (/^[A-Za-z]:\\/.test(workspace)) {
        return `\\\\?\\${workspace}`;
    }
    if (/^\\\\[^\\]/.test(workspace)) {
        return `\\\\?\\UNC\\${workspace.slice(2)}`;
    }
    return '';
}
export function buildCodexWorkspacePathStrategy(workspace, fallbackWorkspace = '') {
    const trimmedWorkspace = trimWorkspace(workspace);
    const trimmedFallbackWorkspace = trimWorkspace(fallbackWorkspace);
    const canonicalWorkspace = trimmedWorkspace || trimmedFallbackWorkspace;
    if (process.platform !== 'win32') {
        return {
            canonicalCwd: canonicalWorkspace,
            executionCwd: canonicalWorkspace,
            queryCandidates: trimmedWorkspace ? [trimmedWorkspace] : [],
        };
    }
    const canonicalCwd = canonicalWorkspace ? normalizePlainWindowsWorkspace(canonicalWorkspace) : '';
    const canonicalQueryCwd = trimmedWorkspace ? normalizePlainWindowsWorkspace(trimmedWorkspace) : '';
    const extendedQueryWorkspace = canonicalQueryCwd ? toExtendedWindowsWorkspace(canonicalQueryCwd) : '';
    return {
        canonicalCwd,
        executionCwd: canonicalCwd,
        queryCandidates: Array.from(new Set([canonicalQueryCwd, extendedQueryWorkspace].filter(Boolean))),
    };
}
//# sourceMappingURL=codex-workspace-path.js.map