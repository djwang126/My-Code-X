const CODEX_TURN_LIFECYCLE_BY_STATUS = {
    completed: 'completed',
    interrupted: 'interrupted',
    failed: 'failed',
    in_progress: 'running',
    inProgress: 'running',
};
const TERMINAL_TURN_LIFECYCLES = new Set(['completed', 'interrupted', 'failed']);
export class CodexTurnLifecycleParseError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CodexTurnLifecycleParseError';
    }
}
export function readCodexTurnLifecycle(turnStatus) {
    if (typeof turnStatus !== 'string') {
        return null;
    }
    return CODEX_TURN_LIFECYCLE_BY_STATUS[turnStatus] ?? null;
}
export function parseCodexTurnLifecycle(turnStatus, { fieldName = 'turnStatus' } = {}) {
    const turnLifecycle = readCodexTurnLifecycle(turnStatus);
    if (turnLifecycle) {
        return turnLifecycle;
    }
    throw new CodexTurnLifecycleParseError(`${fieldName} must be one of completed, interrupted, failed, in_progress, or inProgress.`);
}
export function parseCodexTerminalTurnLifecycle(turnStatus, { fieldName = 'turnStatus' } = {}) {
    const turnLifecycle = parseCodexTurnLifecycle(turnStatus, { fieldName });
    if (TERMINAL_TURN_LIFECYCLES.has(turnLifecycle)) {
        return turnLifecycle;
    }
    throw new CodexTurnLifecycleParseError(`${fieldName} must resolve to a terminal lifecycle: completed, interrupted, or failed.`);
}
export function deriveCodexTurnLifecycle(turnStatus) {
    return parseCodexTurnLifecycle(turnStatus);
}
//# sourceMappingURL=derive-codex-turn-lifecycle.js.map