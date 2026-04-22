import {
  parseSessionStreamingTurnLifecycle,
  parseSessionTerminalTurnLifecycle,
  parseSessionTurnExecution,
} from '@my-code-x/contracts';

import type {
  SessionStreamingTurnExecutionState,
  SessionTerminalTurnExecutionState,
  SessionTurnExecutionState,
} from '../../session-types';
import { fail, readRequiredRecord } from './readers';

type SessionTurnExecutionInput = {
  activeTurnId: unknown;
  turnLifecycle: unknown;
};

function readTurnExecutionInput(value: unknown, fieldName: string): SessionTurnExecutionInput {
  const record = readRequiredRecord(value, fieldName);
  return {
    activeTurnId: record.activeTurnId,
    turnLifecycle: record.turnLifecycle,
  };
}

export function parseTurnExecution(value: unknown, fieldName: string): SessionTurnExecutionState {
  return parseSessionTurnExecution(readTurnExecutionInput(value, fieldName), { fieldName });
}

export function parseStreamingTurnExecution(
  value: unknown,
  fieldName: string,
): SessionStreamingTurnExecutionState {
  const turnExecution = parseTurnExecution(value, fieldName);

  if (turnExecution.activeTurnId === null) {
    fail(`${fieldName}.activeTurnId`, 'a string');
  }

  return {
    activeTurnId: turnExecution.activeTurnId,
    turnLifecycle: parseSessionStreamingTurnLifecycle(turnExecution.turnLifecycle, {
      fieldName: `${fieldName}.turnLifecycle`,
    }),
  };
}

export function parseTerminalTurnExecution(
  value: unknown,
  fieldName: string,
): SessionTerminalTurnExecutionState {
  const turnExecution = parseTurnExecution(value, fieldName);

  if (turnExecution.activeTurnId === null) {
    fail(`${fieldName}.activeTurnId`, 'a string');
  }

  return {
    activeTurnId: turnExecution.activeTurnId,
    turnLifecycle: parseSessionTerminalTurnLifecycle(turnExecution.turnLifecycle, {
      fieldName: `${fieldName}.turnLifecycle`,
    }),
  };
}
