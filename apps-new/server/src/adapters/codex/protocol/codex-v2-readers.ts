import { CodexProtocolError } from '../runtime/codex-runtime-error.js';
import { readJsonObject as readTransportJsonObject, readString } from '../transport/jsonl-message.js';
import type { JsonObject, JsonValue } from '../../../shared/index.js';
import type {
  RuntimeErrorInfo,
  RuntimeTerminalTurnStatus,
  RuntimeThread,
  RuntimeThreadEffectiveConfig,
  RuntimeThreadItem,
  RuntimeThreadSnapshot,
  RuntimeTimelineItem,
  RuntimeTurn,
  RuntimeTurnStatus,
} from '../../../ports/index.js';

export function hasCodexEffectiveConfig(payload: JsonObject): boolean {
  return [
    payload.model,
    payload.modelProvider,
    payload.serviceTier,
    payload.cwd,
    payload.approvalPolicy,
    payload.approvalsReviewer,
    payload.sandbox,
    payload.permissionProfile,
    payload.reasoningEffort,
  ].some(value => value !== undefined && value !== null) || readCodexJsonArray(payload.instructionSources, 'Codex thread result.instructionSources').length > 0;
}

export function isRichCodexThreadPayload(payload: JsonObject): boolean {
  const summaryKeys = new Set(['id', 'threadId', 'title', 'name', 'threadName', 'cwd', 'workspace', 'updatedAt', 'updated_at']);
  return Object.keys(payload).some(key => !summaryKeys.has(key));
}

export function isRichCodexTurnPayload(payload: JsonObject | null): boolean {
  if (!payload) {
    return false;
  }

  return Object.keys(payload).some(key => key !== 'id');
}

export function isRichCodexCompletedTurnPayload(payload: JsonObject | null): boolean {
  if (!payload) {
    return false;
  }

  return ['items', 'startedAt', 'completedAt', 'durationMs'].some(key => payload[key] !== undefined);
}

export function readCodexJsonObject(value: JsonValue | undefined, fieldName: string): JsonObject {
  if (value === undefined) {
    throw new CodexProtocolError(`${fieldName} must be an object`);
  }

  return readTransportJsonObject(value, fieldName);
}

export function readCodexJsonObjectOrNull(value: JsonValue | undefined): JsonObject | null {
  if (value === undefined || value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as JsonObject;
}

export function readCodexOptionalString(value: JsonValue | undefined, fieldName: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  return readString(value, fieldName);
}

export function readCodexJsonArray(value: JsonValue | undefined, fieldName: string): readonly JsonValue[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new CodexProtocolError(`${fieldName} must be an array`);
  }

  return value;
}

export function readRequiredCodexJsonArray(value: JsonValue | undefined, fieldName: string): readonly JsonValue[] {
  if (value === undefined || value === null) {
    throw new CodexProtocolError(`${fieldName} must be an array`);
  }

  return readCodexJsonArray(value, fieldName);
}

export function readCodexTextLike(value: JsonValue | undefined): string | null {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return null;
}

export function readCodexNumberLike(value: JsonValue | undefined): number | null {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function readCodexBooleanLike(value: JsonValue | undefined): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }

  return null;
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

export function readCodexThreadItem(value: JsonValue | undefined, fieldName: string): RuntimeThreadItem {
  const payload = readCodexJsonObject(value, fieldName);
  const itemId = readString(payload.id, `${fieldName}.id`);
  const itemKind = readCodexTextLike(payload.type) ?? 'unknown';
  const base = {
    itemId,
    itemKind,
    status: readCodexTextLike(payload.status) ?? readCodexTextLike(payload.state),
    text: readCodexThreadItemText(payload),
    raw: payload,
  };

  switch (itemKind) {
    case 'userMessage':
      return cleanThreadItem({
        ...base,
        itemKind,
        content: readCodexJsonArray(payload.content, `${fieldName}.content`),
      });

    case 'hookPrompt':
      return cleanThreadItem({
        ...base,
        itemKind,
        fragments: readCodexJsonArray(payload.fragments, `${fieldName}.fragments`),
      });

    case 'agentMessage':
      return cleanThreadItem({
        ...base,
        itemKind,
        phase: readCodexTextLike(payload.phase),
        memoryCitation: payload.memoryCitation ?? null,
      });

    case 'plan':
      return cleanThreadItem({ ...base, itemKind });

    case 'reasoning':
      return cleanThreadItem({
        ...base,
        itemKind,
        summary: readCodexJsonArray(payload.summary, `${fieldName}.summary`),
        content: readCodexJsonArray(payload.content, `${fieldName}.content`),
      });

    case 'commandExecution':
      return cleanThreadItem({
        ...base,
        itemKind,
        command: readCodexTextLike(payload.command),
        cwd: readCodexTextLike(payload.cwd),
        processId: readCodexTextLike(payload.processId),
        source: payload.source ?? null,
        commandActions: readCodexJsonArray(payload.commandActions, `${fieldName}.commandActions`),
        aggregatedOutput: readCodexTextLike(payload.aggregatedOutput),
        exitCode: readCodexNumberLike(payload.exitCode),
        durationMs: readCodexNumberLike(payload.durationMs),
      });

    case 'fileChange':
      return cleanThreadItem({
        ...base,
        itemKind,
        changes: readCodexJsonArray(payload.changes, `${fieldName}.changes`),
      });

    case 'mcpToolCall':
      return cleanThreadItem({
        ...base,
        itemKind,
        server: readCodexTextLike(payload.server),
        tool: readCodexTextLike(payload.tool),
        arguments: payload.arguments ?? null,
        result: payload.result ?? null,
        error: payload.error ?? null,
        durationMs: readCodexNumberLike(payload.durationMs),
      });

    case 'dynamicToolCall':
      return cleanThreadItem({
        ...base,
        itemKind,
        namespace: readCodexTextLike(payload.namespace),
        tool: readCodexTextLike(payload.tool),
        arguments: payload.arguments ?? null,
        contentItems: payload.contentItems === undefined || payload.contentItems === null
          ? null
          : readCodexJsonArray(payload.contentItems, `${fieldName}.contentItems`),
        success: readCodexBooleanLike(payload.success),
        durationMs: readCodexNumberLike(payload.durationMs),
      });

    case 'collabAgentToolCall':
      return cleanThreadItem({
        ...base,
        itemKind,
        tool: payload.tool ?? null,
        senderThreadId: readCodexTextLike(payload.senderThreadId),
        receiverThreadIds: readCodexJsonArray(payload.receiverThreadIds, `${fieldName}.receiverThreadIds`),
        prompt: readCodexTextLike(payload.prompt),
        model: readCodexTextLike(payload.model),
        reasoningEffort: readCodexTextLike(payload.reasoningEffort),
        agentsStates: payload.agentsStates ?? null,
      });

    case 'webSearch':
      return cleanThreadItem({
        ...base,
        itemKind,
        query: readCodexTextLike(payload.query),
        action: payload.action ?? null,
      });

    case 'imageView':
      return cleanThreadItem({
        ...base,
        itemKind,
        path: readCodexTextLike(payload.path),
      });

    case 'imageGeneration':
      return cleanThreadItem({
        ...base,
        itemKind,
        revisedPrompt: readCodexTextLike(payload.revisedPrompt),
        result: readCodexTextLike(payload.result),
        savedPath: readCodexTextLike(payload.savedPath),
      });

    case 'enteredReviewMode':
    case 'exitedReviewMode':
      return cleanThreadItem({
        ...base,
        itemKind,
        review: readCodexTextLike(payload.review),
      });

    case 'contextCompaction':
      return cleanThreadItem({ ...base, itemKind });

    default:
      return cleanThreadItem({
        ...base,
        itemKind: 'unknown',
        unknownItemKind: itemKind,
      });
  }
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

export function readCodexEffectiveConfig(payload: JsonObject): RuntimeThreadEffectiveConfig {
  return {
    model: readCodexTextLike(payload.model),
    modelProvider: readCodexTextLike(payload.modelProvider),
    serviceTier: payload.serviceTier ?? null,
    cwd: readCodexTextLike(payload.cwd),
    instructionSources: readCodexJsonArray(payload.instructionSources, 'Codex thread result.instructionSources').map(item =>
      readString(item, 'Codex instruction source'),
    ),
    approvalPolicy: payload.approvalPolicy ?? null,
    approvalsReviewer: payload.approvalsReviewer ?? null,
    sandbox: payload.sandbox ?? null,
    permissionProfile: payload.permissionProfile ?? null,
    reasoningEffort: readCodexTextLike(payload.reasoningEffort),
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

export function readCodexRuntimeError(value: JsonValue): RuntimeErrorInfo {
  if (typeof value === 'string') {
    return { message: value, code: null };
  }

  const payload = readCodexJsonObject(value, 'Codex runtime error');
  const details = readCodexTextLike(payload.additionalDetails);
  return cleanRuntimeError({
    message: readCodexTextLike(payload.message) ?? readCodexTextLike(payload.reason) ?? 'Codex runtime error',
    code: readCodexTextLike(payload.code) ?? readCodexTextLike(readCodexJsonObjectOrNull(payload.codexErrorInfo)?.type),
    details: details ?? undefined,
  });
}

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

function setDefined(target: Record<string, unknown>, key: string, value: unknown): void {
  if (value !== undefined && value !== null) {
    target[key] = value;
  }
}

function cleanThreadItem<T extends RuntimeThreadItem>(item: T): T {
  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(item)) {
    if (value !== undefined) {
      output[key] = value;
    }
  }

  return output as T;
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

function cleanRuntimeError(error: RuntimeErrorInfo): RuntimeErrorInfo {
  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(error)) {
    if (value !== undefined) {
      output[key] = value;
    }
  }

  return output as unknown as RuntimeErrorInfo;
}

function readCodexThreadItemText(payload: JsonObject): string | null {
  const directText = readCodexTextLike(payload.text) ?? readCodexTextLike(payload.message) ?? readCodexTextLike(payload.delta);

  if (directText !== null) {
    return directText;
  }

  switch (readCodexTextLike(payload.type)) {
    case 'userMessage':
      return readUserMessageText(payload.content);
    case 'hookPrompt':
      return readHookPromptText(payload.fragments);
    case 'reasoning':
      return readStringArrayText(payload.summary) || readStringArrayText(payload.content) || null;
    case 'commandExecution':
      return readCodexTextLike(payload.command) ?? readCodexTextLike(payload.aggregatedOutput);
    case 'fileChange':
      return readFileChangeText(payload.changes);
    case 'mcpToolCall':
      return [readCodexTextLike(payload.server), readCodexTextLike(payload.tool)].filter(Boolean).join('.') || null;
    case 'dynamicToolCall':
    case 'collabAgentToolCall':
      return readCodexTextLike(payload.tool);
    case 'webSearch':
      return readCodexTextLike(payload.query);
    case 'imageView':
      return readCodexTextLike(payload.path);
    case 'imageGeneration':
      return readCodexTextLike(payload.revisedPrompt) ?? readCodexTextLike(payload.result);
    case 'enteredReviewMode':
    case 'exitedReviewMode':
      return readCodexTextLike(payload.review);
    case 'contextCompaction':
      return 'Context compacted';
    default:
      return null;
  }
}

function readUserMessageText(value: JsonValue | undefined): string | null {
  const parts = readCodexJsonArray(value, 'Codex user message content')
    .map(item => {
      const payload = readCodexJsonObject(item, 'Codex user input item');
      const type = readCodexTextLike(payload.type);
      if (type === 'text') {
        return readCodexTextLike(payload.text) ?? '';
      }
      if (type === 'skill' || type === 'mention') {
        return `[${type}: ${readCodexTextLike(payload.name) ?? readCodexTextLike(payload.path) ?? ''}]`;
      }
      return type ? `[${type}]` : '';
    })
    .filter(Boolean);

  return parts.length ? parts.join('\n\n') : null;
}

function readHookPromptText(value: JsonValue | undefined): string | null {
  const parts = readCodexJsonArray(value, 'Codex hook prompt fragments')
    .map(item => readCodexTextLike(item) ?? readCodexTextLike(readCodexJsonObjectOrNull(item)?.text) ?? '')
    .filter(Boolean);

  return parts.length ? parts.join('\n') : null;
}

function readStringArrayText(value: JsonValue | undefined): string {
  return readCodexJsonArray(value, 'Codex string array')
    .map(item => readCodexTextLike(item) ?? '')
    .filter(Boolean)
    .join('\n');
}

function readFileChangeText(value: JsonValue | undefined): string | null {
  const paths = readCodexJsonArray(value, 'Codex file changes')
    .map(item => {
      const payload = readCodexJsonObject(item, 'Codex file change');
      return readCodexTextLike(payload.path) ?? readCodexTextLike(payload.filePath);
    })
    .filter(Boolean);

  return paths.length ? paths.join(', ') : null;
}
