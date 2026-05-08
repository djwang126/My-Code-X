export function isWorkspacePathDebugEnabled(env: any) {
    const value = String(env?.MY_CODE_X_DEBUG_WORKSPACE_PATHS || '').trim().toLowerCase();
    return value === '1' || value === 'true';
}
export function logWorkspacePathDebug(enabled: any, details: any) {
    if (!enabled) {
        return;
    }
    process.stdout.write(`[my-code-x-debug] ${JSON.stringify({
        ts: new Date().toISOString(),
        scope: 'codex_workspace_path',
        ...details,
    })}\n`);
}
