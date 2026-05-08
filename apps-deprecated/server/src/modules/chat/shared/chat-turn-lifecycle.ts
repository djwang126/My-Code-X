import { canSessionExecutionInterrupt, canSessionExecutionSend, createInterruptingSessionTurnExecution, createRunningSessionTurnExecution, createStreamingSessionTurnExecution, createTerminalSessionTurnExecution, isSessionExecutionActive, serializeSessionTurnExecution, } from '@my-code-x/contracts';
import type { SessionTurnExecutionState } from '@my-code-x/contracts';
import type { ChatSessionState } from './chat-types.js';
export function applyRuntimeTurnExecution(runtime: ChatSessionState, turnExecution: SessionTurnExecutionState) {
    runtime.turnExecution = serializeSessionTurnExecution(turnExecution, {
        fieldName: 'runtime turn execution',
    });
}
export function markRuntimeTurnRunning(runtime: ChatSessionState, turnId: string) {
    applyRuntimeTurnExecution(runtime, createRunningSessionTurnExecution({
        turnId,
        fieldName: 'runtime turn execution.turnId',
    }));
}
export function markRuntimeTurnInterrupting(runtime: ChatSessionState, turnId: any = runtime.turnExecution.activeTurnId) {
    applyRuntimeTurnExecution(runtime, createInterruptingSessionTurnExecution({
        turnId,
        fieldName: 'runtime turn execution.turnId',
    }));
}
export function markRuntimeTurnStreaming(runtime: ChatSessionState, turnId: any = runtime.turnExecution.activeTurnId) {
    applyRuntimeTurnExecution(runtime, createStreamingSessionTurnExecution({
        turnExecution: runtime.turnExecution,
        turnId,
        fieldName: 'runtime turn execution',
    }));
}
export function markRuntimeTurnCompleted(runtime: ChatSessionState, turnId: string) {
    applyRuntimeTurnExecution(runtime, createTerminalSessionTurnExecution({
        turnId,
        turnLifecycle: 'completed',
        fieldName: 'runtime turn execution',
    }));
}
export function markRuntimeTurnInterrupted(runtime: ChatSessionState, turnId: string) {
    applyRuntimeTurnExecution(runtime, createTerminalSessionTurnExecution({
        turnId,
        turnLifecycle: 'interrupted',
        fieldName: 'runtime turn execution',
    }));
}
export function markRuntimeTurnFailed(runtime: ChatSessionState, turnId: string) {
    applyRuntimeTurnExecution(runtime, createTerminalSessionTurnExecution({
        turnId,
        turnLifecycle: 'failed',
        fieldName: 'runtime turn execution',
    }));
}
export function canRuntimeSend(runtime: ChatSessionState) {
    return canSessionExecutionSend(runtime.turnExecution);
}
export function canRuntimeInterrupt(runtime: ChatSessionState) {
    return canSessionExecutionInterrupt(runtime.turnExecution);
}
export function isRuntimeTurnActive(runtime: ChatSessionState) {
    return isSessionExecutionActive(runtime.turnExecution);
}
