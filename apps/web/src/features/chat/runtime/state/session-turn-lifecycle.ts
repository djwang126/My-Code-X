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

type CreateTurnStartedExecutionInput = {
  turnId: string;
  turnLifecycle: SessionStreamingTurnLifecycle;
};

type CreateStreamingExecutionInput = {
  turnExecution: SessionTurnExecutionState;
  turnId?: string | null;
};

type CreateTurnCompletedExecutionInput = {
  turnId: string;
  turnLifecycle: SessionTerminalTurnLifecycle;
};

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

export function createTurnStartedExecution(input: CreateTurnStartedExecutionInput) {
  return createStartedSessionTurnExecution({
    turnId: input.turnId,
    turnLifecycle: input.turnLifecycle,
    fieldName: 'session turn execution',
  });
}

export function createStreamingExecution(input: CreateStreamingExecutionInput) {
  return createStreamingSessionTurnExecution({
    turnExecution: input.turnExecution,
    turnId: input.turnId,
    fieldName: 'session turn execution',
  });
}

export function createTurnCompletedExecution(input: CreateTurnCompletedExecutionInput) {
  return createTerminalSessionTurnExecution({
    turnId: input.turnId,
    turnLifecycle: input.turnLifecycle,
    fieldName: 'session turn execution',
  });
}
