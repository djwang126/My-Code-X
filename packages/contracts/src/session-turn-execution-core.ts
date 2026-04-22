export type SessionTurnLifecycle = 'idle' | 'running' | 'interrupting' | 'completed' | 'interrupted' | 'failed';

export type SessionStreamingTurnLifecycle = 'running' | 'interrupting';

export type SessionTerminalTurnLifecycle = 'completed' | 'interrupted' | 'failed';

export type SessionIdleTurnExecutionState = {
  activeTurnId: null;
  turnLifecycle: 'idle';
};

export type SessionActiveTurnExecutionState = {
  activeTurnId: string;
  turnLifecycle: Exclude<SessionTurnLifecycle, 'idle'>;
};

export type SessionTurnExecutionState = SessionIdleTurnExecutionState | SessionActiveTurnExecutionState;

export interface ParseSessionFieldInput {
  fieldName?: string;
}

export interface SessionTurnExecutionInput {
  activeTurnId: unknown;
  turnLifecycle: unknown;
}

interface ValidateSessionTurnExecutionInput {
  activeTurnId: string | null;
  turnLifecycle: SessionTurnLifecycle;
}

function validateSessionTurnExecution(
  input: ValidateSessionTurnExecutionInput,
  options: ParseSessionFieldInput = {},
): SessionTurnExecutionState {
  const { activeTurnId, turnLifecycle } = input;
  const fieldName = options.fieldName ?? 'turnExecution';

  if (turnLifecycle === 'idle') {
    if (activeTurnId === null) {
      return {
        activeTurnId: null,
        turnLifecycle: 'idle',
      };
    }

    throw new Error(`${fieldName}.activeTurnId must be null when ${fieldName}.turnLifecycle is idle.`);
  }

  if (activeTurnId === null) {
    throw new Error(
      `${fieldName}.activeTurnId must be a non-empty string when ${fieldName}.turnLifecycle is ${turnLifecycle}.`,
    );
  }

  return {
    activeTurnId,
    turnLifecycle,
  };
}

export function createIdleSessionTurnExecution(): SessionIdleTurnExecutionState {
  return {
    activeTurnId: null,
    turnLifecycle: 'idle',
  };
}

export function readSessionActiveTurnId(activeTurnId: string | null | undefined): string | null {
  if (activeTurnId === null) {
    return null;
  }

  if (typeof activeTurnId !== 'string') {
    return null;
  }

  return activeTurnId.trim() ? activeTurnId : null;
}

export function parseSessionActiveTurnId(activeTurnId: unknown, input: ParseSessionFieldInput = {}): string | null {
  const parsedTurnId = readSessionActiveTurnId(activeTurnId as string | null | undefined);

  if (parsedTurnId !== null || activeTurnId === null) {
    return parsedTurnId;
  }

  const fieldName = input.fieldName ?? 'activeTurnId';
  throw new Error(`${fieldName} must be a non-empty string or null.`);
}

export function readSessionTurnLifecycle(turnLifecycle: SessionTurnLifecycle | null | undefined): SessionTurnLifecycle | null {
  switch (turnLifecycle) {
    case 'running':
    case 'interrupting':
    case 'completed':
    case 'interrupted':
    case 'failed':
    case 'idle':
      return turnLifecycle;
    default:
      return null;
  }
}

export function parseSessionTurnLifecycle(turnLifecycle: unknown, input: ParseSessionFieldInput = {}): SessionTurnLifecycle {
  const parsedLifecycle = readSessionTurnLifecycle(turnLifecycle as SessionTurnLifecycle | null | undefined);

  if (parsedLifecycle) {
    return parsedLifecycle;
  }

  const fieldName = input.fieldName ?? 'turnLifecycle';
  throw new Error(`${fieldName} must be one of idle, running, interrupting, completed, interrupted, or failed.`);
}

export function parseSessionStreamingTurnLifecycle(
  turnLifecycle: unknown,
  input: ParseSessionFieldInput = {},
): SessionStreamingTurnLifecycle {
  const parsedLifecycle = parseSessionTurnLifecycle(turnLifecycle, input);

  if (parsedLifecycle === 'running' || parsedLifecycle === 'interrupting') {
    return parsedLifecycle;
  }

  const fieldName = input.fieldName ?? 'turnLifecycle';
  throw new Error(`${fieldName} must be running or interrupting.`);
}

export function parseSessionTerminalTurnLifecycle(
  turnLifecycle: unknown,
  input: ParseSessionFieldInput = {},
): SessionTerminalTurnLifecycle {
  const parsedLifecycle = parseSessionTurnLifecycle(turnLifecycle, input);

  if (parsedLifecycle === 'completed' || parsedLifecycle === 'interrupted' || parsedLifecycle === 'failed') {
    return parsedLifecycle;
  }

  const fieldName = input.fieldName ?? 'turnLifecycle';
  throw new Error(`${fieldName} must be completed, interrupted, or failed.`);
}

export function readSessionTurnExecution(execution: SessionTurnExecutionInput | null | undefined): SessionTurnExecutionState | null {
  const activeTurnId = readSessionActiveTurnId(execution?.activeTurnId as string | null | undefined);
  const turnLifecycle = readSessionTurnLifecycle(execution?.turnLifecycle as SessionTurnLifecycle | null | undefined);

  if (!turnLifecycle) {
    return null;
  }

  if (turnLifecycle === 'idle') {
    return activeTurnId === null
      ? {
          activeTurnId: null,
          turnLifecycle,
        }
      : null;
  }

  if (activeTurnId === null) {
    return null;
  }

  return {
    activeTurnId,
    turnLifecycle,
  };
}

export function parseSessionTurnExecution(
  execution: SessionTurnExecutionInput,
  input: ParseSessionFieldInput = {},
): SessionTurnExecutionState {
  const fieldName = input.fieldName ?? 'turnExecution';
  const activeTurnId = parseSessionActiveTurnId(execution?.activeTurnId, {
    fieldName: `${fieldName}.activeTurnId`,
  });
  const turnLifecycle = parseSessionTurnLifecycle(execution?.turnLifecycle, {
    fieldName: `${fieldName}.turnLifecycle`,
  });

  return validateSessionTurnExecution({ activeTurnId, turnLifecycle }, { fieldName });
}

export function serializeSessionTurnExecution(
  turnExecution: SessionTurnExecutionState,
  input: ParseSessionFieldInput = {},
): SessionTurnExecutionState {
  return parseSessionTurnExecution(turnExecution, input);
}

export function requireSessionTurnId(turnId: unknown, { fieldName = 'turnId' }: ParseSessionFieldInput = {}): string {
  const parsedTurnId = readSessionActiveTurnId(turnId as string | null | undefined);

  if (parsedTurnId) {
    return parsedTurnId;
  }

  throw new Error(`${fieldName} must be a non-empty string.`);
}
