import {
  parseSessionTurnExecution,
  parseSessionStreamingTurnLifecycle,
  parseSessionTerminalTurnLifecycle,
  readSessionActiveTurnId,
  requireSessionTurnId,
  type ParseSessionFieldInput,
  type SessionActiveTurnExecutionState,
  type SessionTurnExecutionState,
} from './session-turn-execution-core.js';

export interface CreateRunningSessionTurnExecutionInput extends ParseSessionFieldInput {
  turnId?: unknown;
}

export interface CreateStartedSessionTurnExecutionInput extends ParseSessionFieldInput {
  turnId?: unknown;
  turnLifecycle?: unknown;
}

export interface CreateStreamingSessionTurnExecutionInput extends ParseSessionFieldInput {
  turnExecution?: SessionTurnExecutionState;
  turnId?: unknown;
}

function resolveFieldName(options: ParseSessionFieldInput, fallback: string): string {
  return options.fieldName ?? fallback;
}

export function createRunningSessionTurnExecution(
  input: CreateRunningSessionTurnExecutionInput = {},
): SessionActiveTurnExecutionState {
  return {
    activeTurnId: requireSessionTurnId(input.turnId, {
      fieldName: input.fieldName ?? 'turnExecution.turnId',
    }),
    turnLifecycle: 'running',
  };
}

export function createInterruptingSessionTurnExecution(
  input: CreateRunningSessionTurnExecutionInput = {},
): SessionActiveTurnExecutionState {
  return {
    activeTurnId: requireSessionTurnId(input.turnId, {
      fieldName: input.fieldName ?? 'turnExecution.turnId',
    }),
    turnLifecycle: 'interrupting',
  };
}

export function createStartedSessionTurnExecution(
  input: CreateStartedSessionTurnExecutionInput = {},
): SessionActiveTurnExecutionState {
  const turnLifecycle = parseSessionStreamingTurnLifecycle(input.turnLifecycle, {
    fieldName: `${resolveFieldName(input, 'turnExecution')}.turnLifecycle`,
  });
  const turnId = requireSessionTurnId(input.turnId, {
    fieldName: `${resolveFieldName(input, 'turnExecution')}.turnId`,
  });

  return {
    activeTurnId: turnId,
    turnLifecycle,
  };
}

export function createStreamingSessionTurnExecution(
  input: CreateStreamingSessionTurnExecutionInput = {},
): SessionActiveTurnExecutionState {
  const currentTurnExecution = parseSessionTurnExecution(
    input.turnExecution ?? {
      activeTurnId: null,
      turnLifecycle: 'idle',
    },
    {
      fieldName: `${resolveFieldName(input, 'turnExecution')}.current`,
    },
  );
  const turnId = readSessionActiveTurnId(input.turnId as string | null | undefined) ?? currentTurnExecution.activeTurnId;

  if (currentTurnExecution.turnLifecycle === 'interrupting') {
    return createInterruptingSessionTurnExecution({
      turnId,
      fieldName: `${resolveFieldName(input, 'turnExecution')}.turnId`,
    });
  }

  return createRunningSessionTurnExecution({
    turnId,
    fieldName: `${resolveFieldName(input, 'turnExecution')}.turnId`,
  });
}

export function createTerminalSessionTurnExecution(
  input: CreateStartedSessionTurnExecutionInput = {},
): SessionActiveTurnExecutionState {
  const turnLifecycle = parseSessionTerminalTurnLifecycle(input.turnLifecycle, {
    fieldName: `${resolveFieldName(input, 'turnExecution')}.turnLifecycle`,
  });
  const turnId = requireSessionTurnId(input.turnId, {
    fieldName: `${resolveFieldName(input, 'turnExecution')}.turnId`,
  });

  return {
    activeTurnId: turnId,
    turnLifecycle,
  };
}
