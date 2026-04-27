import { CodexProtocolError } from '../runtime/codex-runtime-error.js';
import { readJsonObject, readString } from '../transport/jsonl-message.js';
import type { JsonObject, JsonValue } from '../../../shared/index.js';
import type {
  RuntimeCommand,
  RuntimeInputKind,
  RuntimePendingInput,
  RuntimeResult,
  RuntimeThread,
  RuntimeThreadSnapshot,
  RuntimeTimelineItem,
} from '../../../ports/index.js';

export function mapCodexResultToRuntimeResult(input: MapCodexResultInput): RuntimeResult {
  switch (input.command.kind) {
    case 'start-thread':
      return {
        kind: 'thread-started',
        threadId: readThreadId(input.result),
      };

    case 'resume-thread':
      return {
        kind: 'thread-resumed',
        threadId: readResumeThreadId(input.result),
        snapshot: readThreadSnapshot(input.result),
      };

    case 'list-threads':
      return {
        kind: 'threads-listed',
        threads: readThreads(input.result),
      };

    case 'start-turn':
      return {
        kind: 'turn-started',
        turnId: readTurnId(input.result),
      };

    case 'interrupt-turn':
      return {
        kind: 'ok',
      };

    case 'respond-to-runtime-request':
      return {
        kind: 'runtime-request-responded',
        requestId: input.command.requestId,
      };
  }
}

export interface MapCodexResultInput {
  readonly command: RuntimeCommand;
  readonly result: JsonValue;
}

function readThreadId(result: JsonValue): string {
  const payload = readJsonObject(result, 'Codex thread result');
  const thread = readJsonObject(payload.thread, 'Codex thread result.thread');
  return readString(thread.id, 'Codex thread id');
}

function readResumeThreadId(result: JsonValue): string {
  const payload = readJsonObject(result, 'Codex resume result');

  if (typeof payload.threadId === 'string') {
    return payload.threadId;
  }

  if (payload.thread !== undefined && payload.thread !== null) {
    return readThreadId(result);
  }

  throw new CodexProtocolError('Codex resume result is missing thread id');
}

function readThreadSnapshot(result: JsonValue): RuntimeThreadSnapshot {
  const payload = readJsonObject(result, 'Codex resume result');
  const threadId = readResumeThreadId(result);
  const thread = payload.thread === undefined || payload.thread === null ? null : readJsonObject(payload.thread, 'Codex resume result.thread');
  const timelineItems = payload.messages ?? payload.items ?? payload.timelineItems;

  return {
    threadId,
    title: readTextLike(payload.threadName) ?? readTextLike(thread?.title) ?? readTextLike(thread?.name),
    items: readTimelineItems(timelineItems, 'Codex resume result timeline items'),
    pendingInputs: readPendingInputs(payload.pendingRequests, 'Codex resume result pendingRequests'),
  };
}

function readThreads(result: JsonValue): readonly RuntimeThread[] {
  const payload = readJsonObject(result, 'Codex thread list result');
  return readJsonArray(payload.threads, 'Codex thread list result.threads').map(readThread);
}

function readThread(value: JsonValue): RuntimeThread {
  const payload = readJsonObject(value, 'Codex listed thread');
  const threadId = readTextLike(payload.id) ?? readTextLike(payload.threadId);

  if (!threadId) {
    throw new CodexProtocolError('Codex listed thread is missing id');
  }

  return {
    threadId,
    title: readTextLike(payload.title) ?? readTextLike(payload.name) ?? readTextLike(payload.threadName),
    workspace: readTextLike(payload.cwd) ?? readTextLike(payload.workspace),
    updatedAt: readTextLike(payload.updatedAt) ?? readTextLike(payload.updated_at),
  };
}

function readTurnId(result: JsonValue): string {
  const payload = readJsonObject(result, 'Codex turn result');
  const turn = readJsonObject(payload.turn, 'Codex turn result.turn');
  return readString(turn.id, 'Codex turn id');
}

function readTimelineItems(value: JsonValue | undefined, fieldName: string): readonly RuntimeTimelineItem[] {
  return readJsonArray(value, fieldName).map(readTimelineItem);
}

function readTimelineItem(value: JsonValue): RuntimeTimelineItem {
  const payload = readJsonObject(value, 'Codex timeline item');
  const itemId = readTextLike(payload.id) ?? readTextLike(payload.itemId);

  if (!itemId) {
    throw new CodexProtocolError('Codex timeline item is missing id');
  }

  return {
    itemId,
    itemKind: readTextLike(payload.type) ?? readTextLike(payload.itemType) ?? 'unknown',
    status: readTextLike(payload.status) ?? readTextLike(payload.state),
    text: readTimelineText(payload),
  };
}

function readPendingInputs(value: JsonValue | undefined, fieldName: string): readonly RuntimePendingInput[] {
  return readJsonArray(value, fieldName).map(readPendingInput);
}

function readPendingInput(value: JsonValue): RuntimePendingInput {
  const payload = readJsonObject(value, 'Codex pending input');
  const requestId = readTextLike(payload.id) ?? readTextLike(payload.requestId);

  if (!requestId) {
    throw new CodexProtocolError('Codex pending input is missing id');
  }

  return {
    requestId,
    inputKind: readInputKind(payload),
    prompt: readTextLike(payload.prompt) ?? readTextLike(payload.message) ?? 'Runtime input requested',
  };
}

function readInputKind(payload: JsonObject): RuntimeInputKind {
  const type = readTextLike(payload.type) ?? readTextLike(payload.kind) ?? '';
  const normalizedType = type.toLowerCase();

  if (normalizedType.includes('approval')) {
    return 'approval';
  }

  if (normalizedType.includes('tool')) {
    return 'tool-response';
  }

  return 'unknown';
}

function readTimelineText(payload: JsonObject): string | null {
  const text = readTextLike(payload.text) ?? readTextLike(payload.message);

  if (text !== null) {
    return text;
  }

  if (payload.content !== undefined && payload.content !== null) {
    return readTextLike(payload.content);
  }

  return null;
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

function readJsonArray(value: JsonValue | undefined, fieldName: string): readonly JsonValue[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new CodexProtocolError(`${fieldName} must be an array`);
  }

  return value;
}
