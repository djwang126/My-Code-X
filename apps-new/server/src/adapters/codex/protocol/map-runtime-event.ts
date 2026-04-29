import { CodexProtocolError } from '../runtime/codex-runtime-error.js';
import { formatUnknownCodexPayload, type CodexRuntimeLogger } from '../runtime/codex-runtime-logger.js';
import { readJsonObject, readOptionalString, readString, type CodexIncomingMessage } from '../transport/jsonl-message.js';
import type { JsonObject, JsonValue } from '../../../shared/index.js';
import type {
  RuntimeErrorInfo,
  RuntimeEvent,
  RuntimeInputKind,
  RuntimeOutputKind,
  RuntimeTerminalTurnStatus,
} from '../../../ports/index.js';

export interface MapCodexIncomingMessageInput {
  readonly message: CodexIncomingMessage;
  readonly logger: CodexRuntimeLogger;
}

export function mapCodexIncomingMessageToRuntimeEvent(input: MapCodexIncomingMessageInput): RuntimeEvent | null {
  const message = input.message;

  if (message.kind === 'server-request') {
    return mapCodexServerRequestToRuntimeEvent({ message, logger: input.logger });
  }

  if (message.kind !== 'notification') {
    return null;
  }

  return mapCodexNotificationToRuntimeEvent({
    method: message.method,
    params: message.params,
    logger: input.logger,
  });
}

interface CodexServerRequestInput {
  readonly message: Extract<CodexIncomingMessage, { readonly kind: 'server-request' }>;
  readonly logger: CodexRuntimeLogger;
}

function mapCodexServerRequestToRuntimeEvent(input: CodexServerRequestInput): RuntimeEvent {
  const inputKind = readInputKind(input.message.method, input.message.params);

  if (inputKind === 'unknown') {
    input.logger.warn(formatUnknownCodexPayload({ method: input.message.method, params: input.message.params }));
  }

  return {
    kind: 'runtime-input-requested',
    requestId: input.message.id,
    threadId: readOptionalString(input.message.params.threadId, 'Codex server request threadId'),
    inputKind,
    title: readTextLike(input.message.params.title) ?? input.message.method,
    prompt: readTextLike(input.message.params.prompt) ?? readTextLike(input.message.params.message) ?? input.message.method,
  };
}

export interface CodexNotificationInput {
  readonly method: string;
  readonly params: JsonValue;
  readonly logger: CodexRuntimeLogger;
}

function mapCodexNotificationToRuntimeEvent(input: CodexNotificationInput): RuntimeEvent | null {
  const params = readJsonObject(input.params, 'Codex notification params');

  switch (input.method) {
    case 'turn/started':
      return {
        kind: 'runtime-turn-started',
        threadId: readString(params.threadId, 'Codex turn/started threadId'),
        turnId: readTurnId(params),
      };

    case 'turn/completed':
      return {
        kind: 'runtime-turn-completed',
        threadId: readString(params.threadId, 'Codex turn/completed threadId'),
        turnId: readTurnId(params),
        status: readTurnStatus(params),
        error: readTurnError(params),
      };

    case 'item/agentMessage/delta':
      return mapOutputEvent({ method: input.method, outputKind: 'text-delta', params });

    case 'item/started':
      return mapOutputEvent({ method: input.method, outputKind: 'item-started', params });

    case 'item/completed':
      return mapOutputEvent({ method: input.method, outputKind: 'item-completed', params });

    case 'item/updated':
    case 'item/delta':
      return mapOutputEvent({ method: input.method, outputKind: 'item-updated', params });

    case 'system/notice':
    case 'notice':
      return {
        kind: 'runtime-system-notice',
        threadId: readOptionalString(params.threadId, `${input.method} threadId`),
        level: readNoticeLevel(params),
        message: readNoticeMessage(params),
      };

    case 'error':
    case 'thread/realtime/error':
      return {
        kind: 'runtime-error',
        threadId: readOptionalString(params.threadId, `${input.method} threadId`),
        turnId: readOptionalString(params.turnId, `${input.method} turnId`),
        error: readRuntimeError(params.error ?? params),
      };

    default:
      input.logger.warn(formatUnknownCodexPayload({ method: input.method, params }));
      return null;
  }
}

interface MapOutputEventInput {
  readonly method: string;
  readonly outputKind: RuntimeOutputKind;
  readonly params: JsonObject;
}

function mapOutputEvent(input: MapOutputEventInput): RuntimeEvent {
  return {
    kind: 'runtime-output-updated',
    threadId: readString(input.params.threadId, `${input.method} threadId`),
    turnId: readOptionalString(input.params.turnId, `${input.method} turnId`),
    itemId: readItemId(input.params),
    outputKind: input.outputKind,
    text: readOutputText(input.params),
  };
}

function readTurnId(params: JsonValue): string {
  const payload = readJsonObject(params, 'Codex turn params');

  if (typeof payload.turnId === 'string') {
    return payload.turnId;
  }

  const turn = readJsonObject(payload.turn, 'Codex turn params.turn');
  return readString(turn.id, 'Codex turn id');
}

function readTurnStatus(params: JsonValue): RuntimeTerminalTurnStatus {
  const payload = readJsonObject(params, 'Codex turn params');
  const turn = readJsonObject(payload.turn, 'Codex turn params.turn');
  const status = readString(turn.status, 'Codex turn status');

  switch (status) {
    case 'completed':
    case 'interrupted':
    case 'failed':
      return status;
    default:
      throw new CodexProtocolError(`Unsupported Codex turn status: ${status}`);
  }
}

function readTurnError(params: JsonValue): RuntimeErrorInfo | null {
  const payload = readJsonObject(params, 'Codex turn params');
  const turn = readJsonObject(payload.turn, 'Codex turn params.turn');
  return turn.error === undefined || turn.error === null ? null : readRuntimeError(turn.error);
}

function readRuntimeError(value: JsonValue): RuntimeErrorInfo {
  if (typeof value === 'string') {
    return { message: value, code: null };
  }

  const payload = readJsonObject(value, 'Codex runtime error');
  return {
    message: readTextLike(payload.message) ?? readTextLike(payload.reason) ?? 'Codex runtime error',
    code: readTextLike(payload.code),
  };
}

function readItemId(params: JsonValue): string {
  const payload = readJsonObject(params, 'Codex item params');

  if (typeof payload.itemId === 'string') {
    return payload.itemId;
  }

  const item = readJsonObject(payload.item, 'Codex item params.item');
  return readString(item.id, 'Codex item id');
}

function readOutputText(params: JsonObject): string | null {
  const directText = readTextLike(params.delta) ?? readTextLike(params.text) ?? readTextLike(params.message);

  if (directText !== null) {
    return directText;
  }

  if (params.item !== undefined && params.item !== null) {
    const item = readJsonObject(params.item, 'Codex output item');
    return readTextLike(item.text) ?? readTextLike(item.content) ?? readTextLike(item.message);
  }

  return null;
}

function readInputKind(method: string, params: JsonObject): RuntimeInputKind {
  const type = readTextLike(params.type) ?? readTextLike(params.kind) ?? method;
  const normalizedType = type.toLowerCase();

  if (normalizedType.includes('approval')) {
    return 'approval';
  }

  if (normalizedType.includes('tool')) {
    return 'tool-response';
  }

  return 'unknown';
}

function readNoticeLevel(params: JsonObject): 'info' | 'warning' | 'error' {
  const level = readTextLike(params.level) ?? readTextLike(params.severity) ?? 'info';

  switch (level) {
    case 'warning':
    case 'error':
      return level;
    default:
      return 'info';
  }
}

function readNoticeMessage(params: JsonObject): string {
  return readTextLike(params.message) ?? readTextLike(params.text) ?? 'Codex notice';
}

function readTextLike(value: JsonValue | undefined): string | null {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return null;
}
