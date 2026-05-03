import type { JsonObject, JsonValue } from '@my-code-x/contracts-new/json';
import type { RuntimeThreadItem } from '../../../../ports/index.js';
import {
  readCodexBooleanLike,
  readCodexJsonArray,
  readCodexJsonObject,
  readCodexJsonObjectOrNull,
  readCodexNumberLike,
  readCodexTextLike,
} from '../../protocol/reader/index.js';
import { readString } from '../../protocol/reader/index.js';

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
      return cleanThreadItem({ ...base, itemKind, content: readCodexJsonArray(payload.content, `${fieldName}.content`) });
    case 'hookPrompt':
      return cleanThreadItem({ ...base, itemKind, fragments: readCodexJsonArray(payload.fragments, `${fieldName}.fragments`) });
    case 'agentMessage':
      return cleanThreadItem({ ...base, itemKind, phase: readCodexTextLike(payload.phase), memoryCitation: payload.memoryCitation ?? null });
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
      return cleanThreadItem({ ...base, itemKind, changes: readCodexJsonArray(payload.changes, `${fieldName}.changes`) });
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
      return cleanThreadItem({ ...base, itemKind, query: readCodexTextLike(payload.query), action: payload.action ?? null });
    case 'imageView':
      return cleanThreadItem({ ...base, itemKind, path: readCodexTextLike(payload.path) });
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
      return cleanThreadItem({ ...base, itemKind, review: readCodexTextLike(payload.review) });
    case 'contextCompaction':
      return cleanThreadItem({ ...base, itemKind });
    default:
      return cleanThreadItem({ ...base, itemKind: 'unknown', unknownItemKind: itemKind });
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


