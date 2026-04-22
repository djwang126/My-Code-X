import {
  canSessionExecutionInterrupt,
  canSessionExecutionSend,
  createStartedSessionTurnExecution,
  createStreamingSessionTurnExecution,
  createTerminalSessionTurnExecution,
  isSessionExecutionActive,
  isSessionExecutionTerminal,
} from '@my-code-x/contracts';

import type { SessionTerminalTurnLifecycle, SessionStreamingTurnLifecycle, SessionTurnExecutionState } from '../session-types';

export function canInterruptForTurnExecution(turnExecution: SessionTurnExecutionState) {
  return canSessionExecutionInterrupt(turnExecution);
}

export function canSendForTurnExecution(turnExecution: SessionTurnExecutionState) {
  return canSessionExecutionSend(turnExecution);
}

export function isTurnExecutionActive(turnExecution: SessionTurnExecutionState) {
  return isSessionExecutionActive(turnExecution);
}

export function isTurnExecutionTerminal(turnExecution: SessionTurnExecutionState) {
  return isSessionExecutionTerminal(turnExecution);
}

export function createTurnStartedExecution(input: {
  turnId: string;
  turnLifecycle: SessionStreamingTurnLifecycle;
}) {
  return createStartedSessionTurnExecution({
    turnId: input.turnId,
    turnLifecycle: input.turnLifecycle,
    fieldName: 'session turn execution',
  });
}

export function createStreamingExecution(input: {
  turnExecution: SessionTurnExecutionState;
  turnId?: string | null;
}) {
  return createStreamingSessionTurnExecution({
    turnExecution: input.turnExecution,
    turnId: input.turnId,
    fieldName: 'session turn execution',
  });
}

export function createTurnCompletedExecution(input: {
  turnId: string;
  turnLifecycle: SessionTerminalTurnLifecycle;
}) {
  return createTerminalSessionTurnExecution({
    turnId: input.turnId,
    turnLifecycle: input.turnLifecycle,
    fieldName: 'session turn execution',
  });
}
