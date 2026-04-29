import { CodexProtocolError } from '../runtime/codex-runtime-error.js';
import { isJsonObject, isJsonValue, type JsonObject, type JsonValue } from '../../../shared/index.js';

export type CodexIncomingMessage =
  | CodexResponseMessage
  | CodexErrorResponseMessage
  | CodexNotificationMessage
  | CodexServerRequestMessage;

export interface CodexResponseMessage {
  readonly kind: 'response';
  readonly id: string;
  readonly result: JsonValue;
}

export interface CodexErrorResponseMessage {
  readonly kind: 'error-response';
  readonly id: string;
  readonly error: JsonObject;
}

export interface CodexNotificationMessage {
  readonly kind: 'notification';
  readonly method: string;
  readonly params: JsonObject;
}

export interface CodexServerRequestMessage {
  readonly kind: 'server-request';
  readonly id: string;
  readonly method: string;
  readonly params: JsonObject;
}

export function readJsonObject(value: JsonValue, fieldName: string): JsonObject {
  if (!isJsonObject(value)) {
    throw new CodexProtocolError(`${fieldName} must be an object`);
  }

  return value;
}

export function readOptionalJsonObject(value: JsonValue | undefined, fieldName: string): JsonObject {
  if (value === undefined || value === null) {
    return {};
  }

  return readJsonObject(value, fieldName);
}

export function readString(value: JsonValue | undefined, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new CodexProtocolError(`${fieldName} must be a string`);
  }

  return value;
}

export function readOptionalString(value: JsonValue | undefined, fieldName: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  return readString(value, fieldName);
}

export function parseJsonValue(line: string): JsonValue {
  let parsed: unknown;

  try {
    parsed = JSON.parse(line) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CodexProtocolError(`Codex JSONL message is not valid JSON: ${message}`);
  }

  if (!isJsonValue(parsed)) {
    throw new CodexProtocolError('Codex JSONL message is not valid JSON data');
  }

  return parsed;
}

export function parseCodexIncomingMessage(line: string): CodexIncomingMessage {
  const message = readJsonObject(parseJsonValue(line), 'Codex JSONL message');
  const id = message.id === undefined || message.id === null ? null : String(message.id);
  const method = message.method;

  if (typeof method === 'string' && id) {
    return {
      kind: 'server-request',
      id,
      method,
      params: readOptionalJsonObject(message.params, 'Codex server request params'),
    };
  }

  if (typeof method === 'string') {
    return {
      kind: 'notification',
      method,
      params: readOptionalJsonObject(message.params, 'Codex notification params'),
    };
  }

  if (!id) {
    throw new CodexProtocolError('Codex response message is missing id');
  }

  if (message.error !== undefined && message.error !== null) {
    return {
      kind: 'error-response',
      id,
      error: readJsonObject(message.error, 'Codex error response'),
    };
  }

  return {
    kind: 'response',
    id,
    result: message.result ?? null,
  };
}
