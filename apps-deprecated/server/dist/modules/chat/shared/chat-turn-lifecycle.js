import { canSessionExecutionInterrupt, canSessionExecutionSend, createInterruptingSessionTurnExecution, createRunningSessionTurnExecution, createStreamingSessionTurnExecution, createTerminalSessionTurnExecution, isSessionExecutionActive, serializeSessionTurnExecution, } from '@my-code-x/contracts';
export function applyRuntimeTurnExecution(runtime, turnExecution) {
    runtime.turnExecution = serializeSessionTurnExecution(turnExecution, {
        fieldName: 'runtime turn execution',
    });
}
export function markRuntimeTurnRunning(runtime, turnId) {
    applyRuntimeTurnExecution(runtime, createRunningSessionTurnExecution({
        turnId,
        fieldName: 'runtime turn execution.turnId',
    }));
}
export function markRuntimeTurnInterrupting(runtime, turnId = runtime.turnExecution.activeTurnId) {
    applyRuntimeTurnExecution(runtime, createInterruptingSessionTurnExecution({
        turnId,
        fieldName: 'runtime turn execution.turnId',
    }));
}
export function markRuntimeTurnStreaming(runtime, turnId = runtime.turnExecution.activeTurnId) {
    applyRuntimeTurnExecution(runtime, createStreamingSessionTurnExecution({
        turnExecution: runtime.turnExecution,
        turnId,
        fieldName: 'runtime turn execution',
    }));
}
export function markRuntimeTurnCompleted(runtime, turnId) {
    applyRuntimeTurnExecution(runtime, createTerminalSessionTurnExecution({
        turnId,
        turnLifecycle: 'completed',
        fieldName: 'runtime turn execution',
    }));
}
export function markRuntimeTurnInterrupted(runtime, turnId) {
    applyRuntimeTurnExecution(runtime, createTerminalSessionTurnExecution({
        turnId,
        turnLifecycle: 'interrupted',
        fieldName: 'runtime turn execution',
    }));
}
export function markRuntimeTurnFailed(runtime, turnId) {
    applyRuntimeTurnExecution(runtime, createTerminalSessionTurnExecution({
        turnId,
        turnLifecycle: 'failed',
        fieldName: 'runtime turn execution',
    }));
}
export function canRuntimeSend(runtime) {
    return canSessionExecutionSend(runtime.turnExecution);
}
export function canRuntimeInterrupt(runtime) {
    return canSessionExecutionInterrupt(runtime.turnExecution);
}
export function isRuntimeTurnActive(runtime) {
    return isSessionExecutionActive(runtime.turnExecution);
}
//# sourceMappingURL=chat-turn-lifecycle.js.map