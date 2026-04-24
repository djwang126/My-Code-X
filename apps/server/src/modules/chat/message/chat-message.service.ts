import { createAutoThreadName } from '../thread/thread-name.js';
import { createUserMessage } from '../shared/chat-session-state.js';
import { applyRuntimeChatTurn, canRuntimeSend } from '../shared/chat-turn-state.js';
import { normalizeMessageContent, extractMessagePreviewText } from './chat-message-content.js';
import type { MessageContentItem } from './chat-message-content.js';
import { createHttpError } from '../../../common/errors/http-error.js';
import { serializeChatTurn, type ChatTurn } from '@my-code-x/contracts';
import { normalizeCodexTurnStarted } from '../../../common/codex/normalize-codex-turn.js';
import type { CodexGatewayLike, RuntimeSettings } from '../../../common/codex/codex-types.js';
import type { ChatEventEmitter, ChatSessionRegistry, ChatSessionState } from '../shared/chat-types.js';

interface SendMessageInput {
  viewerId: string;
  slotId: string;
  workspace?: string;
  threadId?: string;
  text?: string;
  content?: MessageContentItem[];
  runtimeSettings?: RuntimeSettings | null;
  collaborationModeKind?: string;
}

interface ChatMessageServiceDependencies {
  codexGateway: CodexGatewayLike;
  now: () => string;
  logger: { warn?: (message: string) => void };
  registry: ChatSessionRegistry;
  emitter: ChatEventEmitter;
  sessionService: {
    getOrCreateRuntimeForSend(input: {
      viewerId: string;
      slotId: string;
      workspace?: string;
      threadId?: string;
      runtimeSettings?: RuntimeSettings | null;
      collaborationModeKind?: string;
    }): Promise<{
      runtime: ChatSessionState;
      createdThread: boolean;
      runtimeSettings?: RuntimeSettings | null;
    }>;
  };
  attachmentService?: {
    resolveContent?: (content: MessageContentItem[]) => Promise<unknown>;
    createDisplayContent?: (
      content: MessageContentItem[],
      selection: { slotId: string; threadId: string },
    ) => Promise<unknown>;
    markAttachmentsReferenced?: (input: {
      content: MessageContentItem[];
      threadId: string;
    }) => Promise<unknown>;
  } | null;
}

export function createChatMessageService({
  codexGateway,
  now,
  logger,
  registry,
  emitter,
  sessionService,
  attachmentService,
}: ChatMessageServiceDependencies) {
  function applyStartedTurn(
    runtime: ChatSessionState,
    {
      turn,
      text,
      content,
      collaborationModeKind,
    }: {
      turn: ChatTurn;
      text: string;
      content?: MessageContentItem[];
      collaborationModeKind?: string;
    },
  ) {
    applyRuntimeChatTurn(runtime, turn);
    if (collaborationModeKind) {
      runtime.collaborationModeKind = collaborationModeKind;
    }
    runtime.messages.push(
      createUserMessage({
        threadId: runtime.threadId,
        turnId: turn.id,
        text,
        content,
      }),
    );
    runtime.lastError = null;
    runtime.lastUpdatedAt = now();
  }

  function normalizeStartedTurn(startedTurn: Record<string, unknown>, runtime: ChatSessionState) {
    const rawTurn =
      startedTurn && typeof startedTurn.turn === 'object' && startedTurn.turn
        ? startedTurn.turn as Record<string, unknown>
        : {
            id: String(startedTurn?.turnId || ''),
            status: 'inProgress',
            error: null,
            startedAt: null,
            completedAt: null,
            durationMs: null,
          };

    return normalizeCodexTurnStarted({
      turn: rawTurn,
      threadId: runtime.threadId,
      source: 'turn_start_response',
      fieldName: 'turn start response.turn',
    });
  }

  async function maybeAutoNameThread(runtime: ChatSessionState, text: string) {
    if (!runtime?.threadId || runtime.threadName || typeof codexGateway.setThreadName !== 'function') {
      return;
    }

    const name = createAutoThreadName(text);
    if (!name) {
      return;
    }

    try {
      await codexGateway.setThreadName({ threadId: runtime.threadId, name });
      runtime.threadName = name;
      runtime.lastUpdatedAt = now();
      emitter.emitSessionMetaUpdated(runtime);
    } catch (error) {
      logger.warn?.(
        `[chat-runtime-service] failed to auto-name chat thread ${runtime.threadId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async function sendMessage({
    viewerId,
    slotId,
    workspace = '',
    threadId,
    text,
    content,
    runtimeSettings,
    collaborationModeKind,
  }: SendMessageInput) {
    const normalizedContent = normalizeMessageContent({ text, content }) as MessageContentItem[];
    const previewText = extractMessagePreviewText(normalizedContent);

    const { runtime, createdThread, runtimeSettings: effectiveRuntimeSettings } = await sessionService.getOrCreateRuntimeForSend({
      viewerId,
      slotId,
      workspace,
      threadId,
      runtimeSettings,
      collaborationModeKind,
    });

    if (!canRuntimeSend(runtime)) {
      throw createHttpError('turn already in progress', 409);
    }

    const effectiveCollaborationModeKind = collaborationModeKind ?? runtime.collaborationModeKind;
    const sendContent = typeof attachmentService?.resolveContent === 'function'
      ? await attachmentService.resolveContent(normalizedContent)
      : normalizedContent;
    const displayContent = typeof attachmentService?.createDisplayContent === 'function'
      ? await attachmentService.createDisplayContent(normalizedContent, {
          slotId: runtime.slotId,
          threadId: runtime.threadId,
        })
      : normalizedContent;
    const startedTurn = await codexGateway.startTurn!({
      threadId: runtime.threadId,
      workspace: runtime.workspace,
      ...(content ? { content: sendContent } : { text: previewText }),
      runtimeSettings: effectiveRuntimeSettings,
      collaborationModeKind: effectiveCollaborationModeKind,
    });
    const turn = normalizeStartedTurn(startedTurn as Record<string, unknown>, runtime);
    if (typeof attachmentService?.markAttachmentsReferenced === 'function') {
      await attachmentService.markAttachmentsReferenced({
        content: normalizedContent,
        threadId: runtime.threadId,
      });
    }

    applyStartedTurn(runtime, {
      turn,
      text: previewText,
      content: displayContent as MessageContentItem[],
      collaborationModeKind: effectiveCollaborationModeKind,
    });
    if (createdThread) {
      await maybeAutoNameThread(runtime, previewText);
    }
    registry.storeRuntime(runtime);
    emitter.emitEvent(
      { slotId: runtime.slotId, threadId: runtime.threadId },
      {
        type: 'turn_started',
        threadId: runtime.threadId,
        turn: serializeChatTurn(runtime.latestTurn, {
          fieldName: 'chat message started event.turn',
        }),
      },
    );

    return {
      threadId: runtime.threadId,
      turn: serializeChatTurn(runtime.latestTurn, {
        fieldName: 'chat message accepted turn',
      }),
    };
  }

  return {
    sendMessage,
  };
}

