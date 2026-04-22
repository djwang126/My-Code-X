type CodexTurnLifecycle = 'completed' | 'interrupted' | 'failed' | 'running';
const CODEX_TURN_LIFECYCLE_BY_STATUS: Record<string, CodexTurnLifecycle> = {
    completed: 'completed',
    interrupted: 'interrupted',
    failed: 'failed',
    in_progress: 'running',
    inProgress: 'running',
};
const TERMINAL_TURN_LIFECYCLES = new Set(['completed', 'interrupted', 'failed']);
export class CodexTurnLifecycleParseError extends Error {
    constructor(message: any) {
        super(message);
        this.name = 'CodexTurnLifecycleParseError';
    }
}
export function readCodexTurnLifecycle(turnStatus: any) {
    if (typeof turnStatus !== 'string') {
        return null;
    }
    return CODEX_TURN_LIFECYCLE_BY_STATUS[turnStatus] ?? null;
}
export function parseCodexTurnLifecycle(turnStatus: any, { fieldName = 'turnStatus' }: any = {}) {
    const turnLifecycle = readCodexTurnLifecycle(turnStatus);
    if (turnLifecycle) {
        return turnLifecycle;
    }
    throw new CodexTurnLifecycleParseError(`${fieldName} must be one of completed, interrupted, failed, in_progress, or inProgress.`);
}
export function parseCodexTerminalTurnLifecycle(turnStatus: any, { fieldName = 'turnStatus' }: any = {}) {
    const turnLifecycle = parseCodexTurnLifecycle(turnStatus, { fieldName });
    if (TERMINAL_TURN_LIFECYCLES.has(turnLifecycle)) {
        return turnLifecycle;
    }
    throw new CodexTurnLifecycleParseError(`${fieldName} must resolve to a terminal lifecycle: completed, interrupted, or failed.`);
}
export function deriveCodexTurnLifecycle(turnStatus: any) {
    return parseCodexTurnLifecycle(turnStatus);
}
