import { formatUnknownCodexPayload, type CodexRuntimeLogger } from '../runtime/codex-runtime-logger.js';
import { readOptionalString, readString, type CodexIncomingMessage } from '../transport/jsonl-message.js';
import type { JsonObject, JsonValue } from '../../../shared/index.js';
import type {
  RuntimeCodexNotificationSemanticKind,
  RuntimeEvent,
  RuntimeInputKind,
  RuntimeItemDeltaKind,
} from '../../../ports/index.js';
import {
  isRichCodexCompletedTurnPayload,
  isRichCodexTurnPayload,
  readCodexJsonArray,
  readCodexJsonObject,
  readCodexJsonObjectOrNull,
  readCodexRuntimeError,
  readCodexTerminalTurnStatus,
  readCodexTextLike,
  readCodexThread,
  readCodexThreadItem,
  readCodexTurn,
} from './codex-v2-readers.js';

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
  const request = classifyRuntimeInputRequest(input.message.method, input.message.params);

  if (request.inputKind === 'unknown') {
    input.logger.warn(formatUnknownCodexPayload({ method: input.message.method, params: input.message.params }));
  }

  return {
    kind: 'runtime-input-requested',
    requestId: input.message.id,
    method: input.message.method,
    threadId: readServerRequestThreadId(input.message.params),
    turnId: readOptionalString(input.message.params.turnId, 'Codex server request turnId'),
    itemId: readOptionalString(input.message.params.itemId, 'Codex server request itemId'),
    inputKind: request.inputKind,
    title: request.title,
    prompt: request.prompt,
    data: input.message.params,
  };
}

export interface CodexNotificationInput {
  readonly method: string;
  readonly params: JsonValue;
  readonly logger: CodexRuntimeLogger;
}

function mapCodexNotificationToRuntimeEvent(input: CodexNotificationInput): RuntimeEvent | null {
  const params = readCodexJsonObject(input.params, 'Codex notification params');

  switch (input.method) {
    case 'thread/started':
      return {
        kind: 'runtime-thread-started',
        thread: readCodexThread(params.thread, 'Codex thread/started thread'),
      };

    case 'thread/status/changed':
      return {
        kind: 'runtime-thread-status-changed',
        threadId: readString(params.threadId, 'Codex thread/status/changed threadId'),
        status: params.status ?? { type: 'notLoaded' },
      };

    case 'thread/name/updated':
      return {
        kind: 'runtime-thread-name-updated',
        threadId: readString(params.threadId, 'Codex thread/name/updated threadId'),
        name: readOptionalString(params.threadName, 'Codex thread/name/updated threadName'),
      };

    case 'thread/archived':
      return {
        kind: 'runtime-thread-archived',
        threadId: readString(params.threadId, 'Codex thread/archived threadId'),
      };

    case 'thread/unarchived':
      return {
        kind: 'runtime-thread-unarchived',
        threadId: readString(params.threadId, 'Codex thread/unarchived threadId'),
      };

    case 'thread/closed':
      return {
        kind: 'runtime-thread-closed',
        threadId: readString(params.threadId, 'Codex thread/closed threadId'),
      };

    case 'thread/tokenUsage/updated':
      return {
        kind: 'runtime-thread-token-usage-updated',
        threadId: readString(params.threadId, 'Codex thread/tokenUsage/updated threadId'),
        turnId: readString(params.turnId, 'Codex thread/tokenUsage/updated turnId'),
        tokenUsage: readCodexJsonObject(params.tokenUsage, 'Codex thread/tokenUsage/updated tokenUsage'),
      };

    case 'turn/started': {
      const threadId = readString(params.threadId, 'Codex turn/started threadId');
      const turn = params.turn === undefined || params.turn === null ? null : readCodexTurn(params.turn, 'Codex turn/started turn');
      const turnId = turn?.id ?? readString(params.turnId, 'Codex turn/started turnId');
      return cleanRuntimeEvent({
        kind: 'runtime-turn-started',
        threadId,
        turn: turn && isRichCodexTurnPayload(turn.raw ?? null) ? turn : undefined,
        turnId,
      });
    }

    case 'turn/completed': {
      const turn = readCodexTurn(params.turn, 'Codex turn/completed turn');
      return cleanRuntimeEvent({
        kind: 'runtime-turn-completed',
        threadId: readString(params.threadId, 'Codex turn/completed threadId'),
        turn: isRichCodexCompletedTurnPayload(turn.raw ?? null) ? turn : undefined,
        turnId: turn.id,
        status: readCodexTerminalTurnStatus(turn.status),
        error: turn.error,
      });
    }

    case 'item/started':
      return {
        kind: 'runtime-item-started',
        threadId: readString(params.threadId, 'Codex item/started threadId'),
        turnId: readString(params.turnId, 'Codex item/started turnId'),
        item: readCodexThreadItem(params.item, 'Codex item/started item'),
      };

    case 'item/completed':
      return {
        kind: 'runtime-item-completed',
        threadId: readString(params.threadId, 'Codex item/completed threadId'),
        turnId: readString(params.turnId, 'Codex item/completed turnId'),
        item: readCodexThreadItem(params.item, 'Codex item/completed item'),
      };

    case 'item/agentMessage/delta':
      return mapItemDeltaEvent({ method: input.method, deltaKind: 'agent-message', params, textField: 'delta' });

    case 'item/plan/delta':
      return mapItemDeltaEvent({ method: input.method, deltaKind: 'plan', params, textField: 'delta' });

    case 'item/reasoning/summaryTextDelta':
      return mapItemDeltaEvent({ method: input.method, deltaKind: 'reasoning-summary-text', params, textField: 'delta' });

    case 'item/reasoning/summaryPartAdded':
      return mapItemDeltaEvent({ method: input.method, deltaKind: 'reasoning-summary-part', params, textField: null });

    case 'item/reasoning/textDelta':
      return mapItemDeltaEvent({ method: input.method, deltaKind: 'reasoning-text', params, textField: 'delta' });

    case 'item/commandExecution/outputDelta':
      return mapItemDeltaEvent({ method: input.method, deltaKind: 'command-output', params, textField: 'delta' });

    case 'item/commandExecution/terminalInteraction':
      return mapItemDeltaEvent({ method: input.method, deltaKind: 'terminal-interaction', params, textField: 'stdin' });

    case 'item/fileChange/outputDelta':
      return mapItemDeltaEvent({ method: input.method, deltaKind: 'file-change-output', params, textField: 'delta' });

    case 'item/fileChange/patchUpdated':
      return mapItemDeltaEvent({ method: input.method, deltaKind: 'file-change-patch', params, textField: null });

    case 'item/mcpToolCall/progress':
      return mapItemDeltaEvent({ method: input.method, deltaKind: 'mcp-tool-progress', params, textField: 'message' });

    case 'turn/diff/updated':
      return {
        kind: 'runtime-turn-diff-updated',
        threadId: readString(params.threadId, 'Codex turn/diff/updated threadId'),
        turnId: readString(params.turnId, 'Codex turn/diff/updated turnId'),
        diff: readString(params.diff, 'Codex turn/diff/updated diff'),
      };

    case 'turn/plan/updated':
      return {
        kind: 'runtime-turn-plan-updated',
        threadId: readString(params.threadId, 'Codex turn/plan/updated threadId'),
        turnId: readString(params.turnId, 'Codex turn/plan/updated turnId'),
        explanation: readOptionalString(params.explanation, 'Codex turn/plan/updated explanation'),
        plan: readCodexJsonArray(params.plan, 'Codex turn/plan/updated plan'),
      };

    case 'serverRequest/resolved':
      return {
        kind: 'runtime-input-resolved',
        threadId: readString(params.threadId, 'Codex serverRequest/resolved threadId'),
        requestId: readString(params.requestId, 'Codex serverRequest/resolved requestId'),
      };

    case 'hook/started':
      return mapKnownCodexNotification({
        method: input.method,
        params,
        semanticKind: 'hook-started',
        turnId: readOptionalString(params.turnId, 'Codex hook/started turnId'),
      });

    case 'hook/completed':
      return mapKnownCodexNotification({
        method: input.method,
        params,
        semanticKind: 'hook-completed',
        turnId: readOptionalString(params.turnId, 'Codex hook/completed turnId'),
      });

    case 'item/autoApprovalReview/started':
      return mapKnownCodexNotification({
        method: input.method,
        params,
        semanticKind: 'auto-approval-review-started',
        turnId: readString(params.turnId, 'Codex item/autoApprovalReview/started turnId'),
        itemId: readOptionalString(params.targetItemId, 'Codex item/autoApprovalReview/started targetItemId'),
      });

    case 'item/autoApprovalReview/completed':
      return mapKnownCodexNotification({
        method: input.method,
        params,
        semanticKind: 'auto-approval-review-completed',
        turnId: readString(params.turnId, 'Codex item/autoApprovalReview/completed turnId'),
        itemId: readOptionalString(params.targetItemId, 'Codex item/autoApprovalReview/completed targetItemId'),
      });

    case 'rawResponseItem/completed':
      return mapKnownCodexNotification({
        method: input.method,
        params,
        semanticKind: 'raw-response-item-completed',
        turnId: readString(params.turnId, 'Codex rawResponseItem/completed turnId'),
      });

    case 'command/exec/outputDelta':
      return mapKnownCodexNotification({
        method: input.method,
        params,
        semanticKind: 'command-exec-output-delta',
      });

    case 'skills/changed':
      return mapKnownCodexNotification({
        method: input.method,
        params,
        semanticKind: 'skills-changed',
      });

    case 'mcpServer/oauthLogin/completed':
      return mapKnownCodexNotification({
        method: input.method,
        params,
        semanticKind: 'mcp-server-oauth-login-completed',
      });

    case 'mcpServer/startupStatus/updated':
      return mapKnownCodexNotification({
        method: input.method,
        params,
        semanticKind: 'mcp-server-status-updated',
      });

    case 'account/updated':
      return mapKnownCodexNotification({
        method: input.method,
        params,
        semanticKind: 'account-updated',
      });

    case 'account/rateLimits/updated':
      return mapKnownCodexNotification({
        method: input.method,
        params,
        semanticKind: 'account-rate-limits-updated',
      });

    case 'app/list/updated':
      return mapKnownCodexNotification({
        method: input.method,
        params,
        semanticKind: 'app-list-updated',
      });

    case 'externalAgentConfig/import/completed':
      return mapKnownCodexNotification({
        method: input.method,
        params,
        semanticKind: 'external-agent-config-import-completed',
      });

    case 'fs/changed':
      return mapKnownCodexNotification({
        method: input.method,
        params,
        semanticKind: 'fs-changed',
      });

    case 'thread/compacted':
      return mapKnownCodexNotification({
        method: input.method,
        params,
        semanticKind: 'context-compacted',
        turnId: readString(params.turnId, 'Codex thread/compacted turnId'),
      });

    case 'model/rerouted':
      return mapKnownCodexNotification({
        method: input.method,
        params,
        semanticKind: 'model-rerouted',
      });

    case 'model/verification':
      return mapKnownCodexNotification({
        method: input.method,
        params,
        semanticKind: 'model-verification',
      });

    case 'guardianWarning':
      return mapKnownCodexNotification({
        method: input.method,
        params,
        semanticKind: 'guardian-warning',
      });

    case 'deprecationNotice':
      return mapKnownCodexNotification({
        method: input.method,
        params,
        semanticKind: 'deprecation-notice',
      });

    case 'configWarning':
      return mapKnownCodexNotification({
        method: input.method,
        params,
        semanticKind: 'config-warning',
      });

    case 'fuzzyFileSearch/sessionUpdated':
      return mapKnownCodexNotification({
        method: input.method,
        params,
        semanticKind: 'fuzzy-file-search-session-updated',
      });

    case 'fuzzyFileSearch/sessionCompleted':
      return mapKnownCodexNotification({
        method: input.method,
        params,
        semanticKind: 'fuzzy-file-search-session-completed',
      });

    case 'windows/worldWritableWarning':
      return mapKnownCodexNotification({
        method: input.method,
        params,
        semanticKind: 'windows-world-writable-warning',
      });

    case 'windowsSandbox/setupCompleted':
      return mapKnownCodexNotification({
        method: input.method,
        params,
        semanticKind: 'windows-sandbox-setup-completed',
      });

    case 'thread/realtime/started':
      return mapKnownCodexNotification({
        method: input.method,
        params,
        semanticKind: 'thread-realtime-started',
      });

    case 'thread/realtime/itemAdded':
      return mapKnownCodexNotification({
        method: input.method,
        params,
        semanticKind: 'thread-realtime-item-added',
      });

    case 'thread/realtime/transcript/delta':
      return mapKnownCodexNotification({
        method: input.method,
        params,
        semanticKind: 'thread-realtime-transcript-delta',
      });

    case 'thread/realtime/transcript/done':
      return mapKnownCodexNotification({
        method: input.method,
        params,
        semanticKind: 'thread-realtime-transcript-done',
      });

    case 'thread/realtime/outputAudio/delta':
      return mapKnownCodexNotification({
        method: input.method,
        params,
        semanticKind: 'thread-realtime-output-audio-delta',
        itemId: readOptionalString(readCodexJsonObjectOrNull(params.audio)?.itemId, 'Codex thread/realtime/outputAudio/delta audio.itemId'),
      });

    case 'thread/realtime/sdp':
      return mapKnownCodexNotification({
        method: input.method,
        params,
        semanticKind: 'thread-realtime-sdp',
      });

    case 'thread/realtime/closed':
      return mapKnownCodexNotification({
        method: input.method,
        params,
        semanticKind: 'thread-realtime-closed',
      });

    case 'account/login/completed':
      return mapKnownCodexNotification({
        method: input.method,
        params,
        semanticKind: 'account-login-completed',
      });

    case 'warning':
    case 'system/notice':
    case 'notice':
      return {
        kind: 'runtime-system-notice',
        threadId: readOptionalString(params.threadId, `${input.method} threadId`),
        level: readNoticeLevel(params),
        message: readNoticeMessage(params),
      };

    case 'error':
      return {
        kind: 'runtime-error',
        threadId: readOptionalString(params.threadId, 'Codex error threadId'),
        turnId: readOptionalString(params.turnId, 'Codex error turnId'),
        error: readCodexRuntimeError(params.error ?? params),
      };

    case 'thread/realtime/error':
      return {
        kind: 'runtime-error',
        threadId: readOptionalString(params.threadId, 'Codex thread/realtime/error threadId'),
        turnId: null,
        error: {
          message: readCodexTextLike(params.message) ?? readCodexTextLike(params.reason) ?? 'codex realtime error',
          code: null,
        },
      };

    default:
      input.logger.warn(formatUnknownCodexPayload({ method: input.method, params }));
      return null;
  }
}

interface RuntimeInputRequestClassification {
  readonly inputKind: RuntimeInputKind;
  readonly title: string;
  readonly prompt: string;
}

function cleanRuntimeEvent<T extends RuntimeEvent>(event: T): T {
  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(event)) {
    if (value !== undefined) {
      output[key] = value;
    }
  }

  return output as T;
}

function classifyRuntimeInputRequest(method: string, params: JsonObject): RuntimeInputRequestClassification {
  switch (method) {
    case 'item/commandExecution/requestApproval':
      return {
        inputKind: 'approval',
        title: 'Approve command execution',
        prompt: readCodexTextLike(params.command) ?? readCodexTextLike(params.reason) ?? 'Review the pending command',
      };

    case 'item/fileChange/requestApproval':
      return {
        inputKind: 'approval',
        title: 'Approve file changes',
        prompt: readCodexTextLike(params.reason) ?? 'Review the pending file changes',
      };

    case 'item/permissions/requestApproval':
      return {
        inputKind: 'approval',
        title: 'Approve permissions request',
        prompt: readCodexTextLike(params.reason) ?? 'Review the requested permissions',
      };

    case 'item/tool/requestUserInput':
      return {
        inputKind: 'form',
        title: 'Runtime input requested',
        prompt: readCodexTextLike(params.prompt) ?? readCodexTextLike(params.message) ?? '',
      };

    case 'mcpServer/elicitation/request':
      return {
        inputKind: 'form',
        title: 'MCP server input',
        prompt: readCodexTextLike(params.message) ?? 'Provide the requested MCP input',
      };

    case 'item/tool/call':
      return {
        inputKind: 'tool-response',
        title: 'Dynamic tool call',
        prompt: readCodexTextLike(params.tool) ?? 'Provide the dynamic tool response',
      };

    case 'account/chatgptAuthTokens/refresh':
      return {
        inputKind: 'auth',
        title: 'Refresh ChatGPT authentication',
        prompt: readCodexTextLike(params.reason) ?? 'Codex needs refreshed ChatGPT credentials.',
      };

    case 'applyPatchApproval':
      return {
        inputKind: 'approval',
        title: 'Approve patch changes',
        prompt: readCodexTextLike(params.reason) ?? 'Review the requested patch',
      };

    case 'execCommandApproval':
      return {
        inputKind: 'approval',
        title: 'Approve command execution',
        prompt: readLegacyCommandPrompt(params),
      };

    default:
      return {
        inputKind: readInputKindFromLoosePayload(method, params),
        title: readCodexTextLike(params.title) ?? method,
        prompt: readCodexTextLike(params.prompt) ?? readCodexTextLike(params.message) ?? method,
      };
  }
}

function readServerRequestThreadId(params: JsonObject): string | null {
  return readOptionalString(params.threadId, 'Codex server request threadId')
    ?? readOptionalString(params.conversationId, 'Codex server request conversationId');
}

function readLegacyCommandPrompt(params: JsonObject): string {
  if (Array.isArray(params.command)) {
    return params.command.map(item => readCodexTextLike(item) ?? '').filter(Boolean).join(' ');
  }

  return readCodexTextLike(params.reason) ?? 'Review the pending command';
}

interface MapItemDeltaEventInput {
  readonly method: string;
  readonly deltaKind: RuntimeItemDeltaKind;
  readonly params: JsonObject;
  readonly textField: string | null;
}

function mapItemDeltaEvent(input: MapItemDeltaEventInput): RuntimeEvent {
  return {
    kind: 'runtime-item-delta',
    threadId: readString(input.params.threadId, `${input.method} threadId`),
    turnId: readString(input.params.turnId, `${input.method} turnId`),
    itemId: readString(input.params.itemId, `${input.method} itemId`),
    deltaKind: input.deltaKind,
    text: input.textField ? readCodexTextLike(input.params[input.textField]) : null,
    data: input.params,
  };
}

interface MapKnownCodexNotificationInput {
  readonly method: string;
  readonly params: JsonObject;
  readonly semanticKind: RuntimeCodexNotificationSemanticKind;
  readonly turnId?: string | null;
  readonly itemId?: string | null;
}

function mapKnownCodexNotification(input: MapKnownCodexNotificationInput): RuntimeEvent {
  return {
    kind: 'runtime-codex-notification',
    semanticKind: input.semanticKind,
    method: input.method,
    threadId: readOptionalString(input.params.threadId, `${input.method} threadId`),
    turnId: input.turnId ?? readOptionalString(input.params.turnId, `${input.method} turnId`),
    itemId: input.itemId ?? readOptionalString(input.params.itemId, `${input.method} itemId`),
    data: input.params,
  };
}

function readInputKindFromLoosePayload(method: string, params: JsonObject): RuntimeInputKind {
  const type = readCodexTextLike(params.type) ?? readCodexTextLike(params.kind) ?? method;
  const normalizedType = type.toLowerCase();

  if (normalizedType.includes('auth')) {
    return 'auth';
  }

  if (normalizedType.includes('approval')) {
    return 'approval';
  }

  if (normalizedType.includes('tool')) {
    return 'tool-response';
  }

  if (normalizedType.includes('form') || normalizedType.includes('input') || normalizedType.includes('elicitation')) {
    return 'form';
  }

  return 'unknown';
}

function readNoticeLevel(params: JsonObject): 'info' | 'warning' | 'error' {
  const level = readCodexTextLike(params.level) ?? readCodexTextLike(params.severity) ?? 'info';

  switch (level) {
    case 'warning':
    case 'error':
      return level;
    default:
      return 'info';
  }
}

function readNoticeMessage(params: JsonObject): string {
  return readCodexTextLike(params.message) ?? readCodexTextLike(params.text) ?? 'Codex notice';
}
