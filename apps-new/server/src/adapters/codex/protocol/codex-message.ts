import type { JsonObject, JsonValue } from '@my-code-x/contracts-new/json';
import { readJsonObject, readOptionalJsonObject, parseJsonValue } from './reader/read-json.js';
import { CodexProtocolError } from '../errors/codex-runtime-error.js';

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
