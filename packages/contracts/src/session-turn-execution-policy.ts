import {
  parseSessionTurnExecution,
  readSessionTurnLifecycle,
  type SessionTurnExecutionState,
  type SessionTurnLifecycle,
  type SessionStreamingTurnLifecycle,
} from './session-turn-execution-core.js';

function normalizeTurnLifecycleForPredicates(turnLifecycle: SessionTurnLifecycle | null | undefined): SessionTurnLifecycle {
  return readSessionTurnLifecycle(turnLifecycle) ?? 'idle';
}

export function isSessionTurnActive(turnLifecycle: SessionTurnLifecycle | null | undefined): boolean {
  const normalizedLifecycle = normalizeTurnLifecycleForPredicates(turnLifecycle);
  return normalizedLifecycle === 'running' || normalizedLifecycle === 'interrupting';
}

export function isSessionTurnTerminal(turnLifecycle: SessionTurnLifecycle | null | undefined): boolean {
  const normalizedLifecycle = normalizeTurnLifecycleForPredicates(turnLifecycle);
  return (
    normalizedLifecycle === 'completed' ||
    normalizedLifecycle === 'interrupted' ||
    normalizedLifecycle === 'failed'
  );
}

export function canSessionTurnInterrupt(turnLifecycle: SessionTurnLifecycle | null | undefined): boolean {
  return normalizeTurnLifecycleForPredicates(turnLifecycle) === 'running';
}

export function canSessionTurnSend(turnLifecycle: SessionTurnLifecycle | null | undefined): boolean {
  return !isSessionTurnActive(turnLifecycle);
}

export function deriveSessionStreamingLifecycle(
  turnLifecycle: SessionTurnLifecycle | null | undefined,
): SessionStreamingTurnLifecycle {
  return normalizeTurnLifecycleForPredicates(turnLifecycle) === 'interrupting' ? 'interrupting' : 'running';
}

export function isSessionWaitingForInput(turnLifecycle: SessionTurnLifecycle | null | undefined): boolean {
  return !isSessionTurnActive(turnLifecycle);
}

export function isSessionExecutionActive(turnExecution: SessionTurnExecutionState): boolean {
  const parsedExecution = parseSessionTurnExecution(turnExecution, {
    fieldName: 'turnExecution',
  });
  return isSessionTurnActive(parsedExecution.turnLifecycle);
}

export function isSessionExecutionTerminal(turnExecution: SessionTurnExecutionState): boolean {
  const parsedExecution = parseSessionTurnExecution(turnExecution, {
    fieldName: 'turnExecution',
  });
  return isSessionTurnTerminal(parsedExecution.turnLifecycle);
}

export function canSessionExecutionInterrupt(turnExecution: SessionTurnExecutionState): boolean {
  const parsedExecution = parseSessionTurnExecution(turnExecution, {
    fieldName: 'turnExecution',
  });
  return parsedExecution.turnLifecycle === 'running';
}

export function canSessionExecutionSend(turnExecution: SessionTurnExecutionState): boolean {
  return !isSessionExecutionActive(turnExecution);
}

export function isSessionExecutionWaitingForInput(turnExecution: SessionTurnExecutionState): boolean {
  return !isSessionExecutionActive(turnExecution);
}
