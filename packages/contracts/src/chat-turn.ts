import { cloneSessionError, type SessionError } from './session-error.js';

export type ChatTurnStatus = 'inProgress' | 'completed' | 'interrupted' | 'failed';

export type ChatTurn = {
  id: string;
  status: ChatTurnStatus;
  error: SessionError | null;
  startedAt: number | null;
  completedAt: number | null;
  durationMs: number | null;
};

export interface ParseChatTurnFieldInput {
  fieldName?: string;
}

export function readChatTurnStatus(status: ChatTurnStatus | string | null | undefined): ChatTurnStatus | null {
  switch (status) {
    case 'inProgress':
    case 'completed':
    case 'interrupted':
    case 'failed':
      return status;
    default:
      return null;
  }
}

export function parseChatTurnStatus(status: unknown, input: ParseChatTurnFieldInput = {}): ChatTurnStatus {
  const parsedStatus = readChatTurnStatus(status as ChatTurnStatus | string | null | undefined);
  if (parsedStatus) {
    return parsedStatus;
  }

  const fieldName = input.fieldName ?? 'chatTurn.status';
  throw new Error(`${fieldName} must be one of inProgress, completed, interrupted, or failed.`);
}

function readNullableNumber(value: unknown, fieldName: string): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  throw new Error(`${fieldName} must be a finite number or null.`);
}

function readRequiredTurnId(value: unknown, fieldName: string) {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  throw new Error(`${fieldName} must be a non-empty string.`);
}

function readChatTurnRecord(value: unknown, fieldName: string): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  throw new Error(`${fieldName} must be an object or null.`);
}

export function parseChatTurn(value: unknown, input: ParseChatTurnFieldInput = {}): ChatTurn {
  const fieldName = input.fieldName ?? 'chatTurn';
  const record = readChatTurnRecord(value, fieldName);

  return {
    id: readRequiredTurnId(record.id, `${fieldName}.id`),
    status: parseChatTurnStatus(record.status, { fieldName: `${fieldName}.status` }),
    error: cloneSessionError(record.error as SessionError | null | undefined),
    startedAt: readNullableNumber(record.startedAt, `${fieldName}.startedAt`),
    completedAt: readNullableNumber(record.completedAt, `${fieldName}.completedAt`),
    durationMs: readNullableNumber(record.durationMs, `${fieldName}.durationMs`),
  };
}

export function parseNullableChatTurn(value: unknown, input: ParseChatTurnFieldInput = {}): ChatTurn | null {
  if (value === null || value === undefined) {
    return null;
  }

  return parseChatTurn(value, input);
}

export function serializeChatTurn(turn: ChatTurn | null | undefined, input: ParseChatTurnFieldInput = {}): ChatTurn | null {
  if (!turn) {
    return null;
  }

  return parseChatTurn(turn, input);
}

export function isChatTurnActive(turn: ChatTurn | null | undefined): boolean {
  return turn?.status === 'inProgress';
}

export function isChatTurnTerminal(turn: ChatTurn | null | undefined): boolean {
  if (!turn) {
    return false;
  }

  return turn.status === 'completed' || turn.status === 'interrupted' || turn.status === 'failed';
}

export function canStartChatTurn(turn: ChatTurn | null | undefined): boolean {
  return !isChatTurnActive(turn);
}

export function canInterruptChatTurn(turn: ChatTurn | null | undefined): boolean {
  return turn?.status === 'inProgress';
}
