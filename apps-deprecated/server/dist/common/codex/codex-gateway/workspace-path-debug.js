export function isWorkspacePathDebugEnabled(env) {
    const value = String(env?.MY_CODE_X_DEBUG_WORKSPACE_PATHS || '').trim().toLowerCase();
    return value === '1' || value === 'true';
}
export function logWorkspacePathDebug(enabled, details) {
    if (!enabled) {
        return;
    }
    process.stdout.write(`[my-code-x-debug] ${JSON.stringify({
        ts: new Date().toISOString(),
        scope: 'codex_workspace_path',
        ...details,
    })}\n`);
}
//# sourceMappingURL=workspace-path-debug.js.map