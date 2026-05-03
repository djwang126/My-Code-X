import { CodexProtocolError } from '../../errors/codex-runtime-error.js';
import type { JsonValue } from '@my-code-x/contracts-new/json';
import type { RuntimeTerminalTurnStatus, RuntimeTurn, RuntimeTurnStatus } from '../../../../ports/index.js';
import { readCodexRuntimeError } from './read-error.js';
import { readCodexThreadItem } from './read-item.js';
import { readCodexJsonArray, readCodexJsonObject, readCodexNumberLike, readCodexTextLike } from '../../protocol/reader/index.js';
import { readString } from '../../protocol/reader/index.js';

export function isRichCodexTurnPayload(payload: JsonObjectOrNull): boolean {
  if (!payload) {
    return false;
  }

  return Object.keys(payload).some(key => key !== 'id');
}

export function isRichCodexCompletedTurnPayload(payload: JsonObjectOrNull): boolean {
  if (!payload) {
    return false;
  }

  return ['items', 'startedAt', 'completedAt', 'durationMs'].some(key => payload[key] !== undefined);
}

export function readCodexTurn(value: JsonValue | undefined, fieldName: string): RuntimeTurn {
  const payload = readCodexJsonObject(value, fieldName);
  const id = readString(payload.id, `${fieldName}.id`);
  const status = readCodexTurnStatus(payload.status, `${fieldName}.status`);

  return {
    id,
    items: readCodexJsonArray(payload.items, `${fieldName}.items`).map(item => readCodexThreadItem(item, `${fieldName}.items[]`)),
    status,
    error: payload.error === undefined || payload.error === null ? null : readCodexRuntimeError(payload.error),
    startedAt: readCodexNumberLike(payload.startedAt),
    completedAt: readCodexNumberLike(payload.completedAt),
    durationMs: readCodexNumberLike(payload.durationMs),
    raw: payload,
  };
}

export function readCodexTerminalTurnStatus(status: RuntimeTurnStatus): RuntimeTerminalTurnStatus {
  switch (status) {
    case 'completed':
    case 'interrupted':
    case 'failed':
      return status;
    case 'inProgress':
      throw new CodexProtocolError('Codex turn/completed status must be terminal');
  }

  throw new CodexProtocolError(`Unsupported Codex terminal turn status: ${String(status)}`);
}

type JsonObjectOrNull = Record<string, JsonValue> | null;

function readCodexTurnStatus(value: JsonValue | undefined, fieldName: string): RuntimeTurnStatus {
  const status = readCodexTextLike(value) ?? 'inProgress';

  switch (status) {
    case 'inProgress':
    case 'completed':
    case 'interrupted':
    case 'failed':
      return status;
    default:
      throw new CodexProtocolError(`Unsupported Codex turn status at ${fieldName}: ${status}`);
  }
}


