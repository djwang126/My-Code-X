import type { JsonObject, JsonValue } from '@my-code-x/contracts-new/json';
import type { RuntimeThread, RuntimeThreadSnapshot, RuntimeTimelineItem, RuntimeTurn } from '../../../../ports/index.js';
import {
  readCodexBooleanLike,
  readCodexJsonArray,
  readCodexJsonObject,
  readCodexNumberLike,
  readCodexTextLike,
} from '../../protocol/reader/index.js';
import { readCodexTurn } from './read-turn.js';
import { readString } from '../../protocol/reader/index.js';

export function isRichCodexThreadPayload(payload: JsonObject): boolean {
  const summaryKeys = new Set(['id', 'threadId', 'title', 'name', 'threadName', 'cwd', 'workspace', 'updatedAt', 'updated_at']);
  return Object.keys(payload).some(key => !summaryKeys.has(key));
}

export function readCodexThread(value: JsonValue | undefined, fieldName: string): RuntimeThread {
  const payload = readCodexJsonObject(value, fieldName);
  const threadId = readString(payload.id, `${fieldName}.id`);
  const turns = readCodexJsonArray(payload.turns, `${fieldName}.turns`).map(item => readCodexTurn(item, `${fieldName}.turns[]`));
  const updatedAtUnix = readCodexNumberLike(payload.updatedAt);
  const title = readCodexTextLike(payload.name);
  const cwd = readCodexTextLike(payload.cwd);
  const thread: Record<string, JsonValue | readonly RuntimeTurn[]> = {
    threadId,
    title,
    workspace: cwd,
    updatedAt: updatedAtUnix === null ? readCodexTextLike(payload.updatedAt) ?? readCodexTextLike(payload.updated_at) : String(updatedAtUnix),
  };

  const rich = isRichCodexThreadPayload(payload);
  if (rich) {
    setDefined(thread, 'id', threadId);
    setDefined(thread, 'forkedFromId', readCodexTextLike(payload.forkedFromId));
    setDefined(thread, 'preview', readCodexTextLike(payload.preview));
    setDefined(thread, 'ephemeral', readCodexBooleanLike(payload.ephemeral));
    setDefined(thread, 'modelProvider', readCodexTextLike(payload.modelProvider));
    setDefined(thread, 'createdAt', readCodexNumberLike(payload.createdAt));
    setDefined(thread, 'updatedAtUnix', updatedAtUnix);
    setDefined(thread, 'status', payload.status);
    setDefined(thread, 'path', readCodexTextLike(payload.path));
    setDefined(thread, 'cwd', cwd);
    setDefined(thread, 'cliVersion', readCodexTextLike(payload.cliVersion));
    setDefined(thread, 'source', payload.source);
    setDefined(thread, 'agentNickname', readCodexTextLike(payload.agentNickname));
    setDefined(thread, 'agentRole', readCodexTextLike(payload.agentRole));
    setDefined(thread, 'gitInfo', payload.gitInfo);
    setDefined(thread, 'name', readCodexTextLike(payload.name));
  }
  if (turns.length) {
    thread.turns = turns;
  }
  if (rich) {
    thread.raw = payload;
  }

  return thread as unknown as RuntimeThread;
}

export function createRuntimeThreadSnapshot(thread: RuntimeThread): RuntimeThreadSnapshot {
  return cleanThreadSnapshot({
    threadId: thread.threadId,
    title: thread.title,
    items: flattenTurnItems(thread.turns ?? []),
    pendingInputs: [],
    turns: thread.turns,
    thread,
  });
}

function setDefined(target: Record<string, unknown>, key: string, value: unknown): void {
  if (value !== undefined && value !== null) {
    target[key] = value;
  }
}

function cleanThreadSnapshot(snapshot: RuntimeThreadSnapshot): RuntimeThreadSnapshot {
  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(snapshot)) {
    if (value !== undefined) {
      output[key] = value;
    }
  }

  return output as unknown as RuntimeThreadSnapshot;
}

function flattenTurnItems(turns: readonly RuntimeTurn[]): readonly RuntimeTimelineItem[] {
  return turns.flatMap(turn => turn.items);
}


