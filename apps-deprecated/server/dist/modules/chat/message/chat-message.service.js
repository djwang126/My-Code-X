import { createAutoThreadName } from '../thread/thread-name.js';
import { createUserMessage } from '../shared/chat-session-state.js';
import { canRuntimeSend, markRuntimeTurnRunning } from '../shared/chat-turn-lifecycle.js';
import { normalizeMessageContent, extractMessagePreviewText } from './chat-message-content.js';
import { createHttpError } from '../../../common/errors/http-error.js';
import { serializeSessionTurnExecution } from '@my-code-x/contracts';
export function createChatMessageService({ codexGateway, now, logger, registry, emitter, sessionService, attachmentService, }) {
    function applyStartedTurn(runtime, { turnId, text, content, collaborationModeKind, }) {
        markRuntimeTurnRunning(runtime, turnId);
        if (collaborationModeKind) {
            runtime.collaborationModeKind = collaborationModeKind;
        }
        runtime.messages.push(createUserMessage({
            threadId: runtime.threadId,
            turnId,
            text,
            content,
        }));
        runtime.lastError = null;
        runtime.lastUpdatedAt = now();
    }
    async function maybeAutoNameThread(runtime, text) {
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
        }
        catch (error) {
            logger.warn?.(`[chat-runtime-service] failed to auto-name chat thread ${runtime.threadId}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async function sendMessage({ viewerId, slotId, workspace = '', threadId, text, content, runtimeSettings, collaborationModeKind, }) {
        const normalizedContent = normalizeMessageContent({ text, content });
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
        const startedTurn = await codexGateway.startTurn({
            threadId: runtime.threadId,
            workspace: runtime.workspace,
            ...(content ? { content: sendContent } : { text: previewText }),
            runtimeSettings: effectiveRuntimeSettings,
            collaborationModeKind: effectiveCollaborationModeKind,
        });
        if (typeof attachmentService?.markAttachmentsReferenced === 'function') {
            await attachmentService.markAttachmentsReferenced({
                content: normalizedContent,
                threadId: runtime.threadId,
            });
        }
        applyStartedTurn(runtime, {
            turnId: startedTurn.turnId,
            text: previewText,
            content: displayContent,
            collaborationModeKind: effectiveCollaborationModeKind,
        });
        if (createdThread) {
            await maybeAutoNameThread(runtime, previewText);
        }
        registry.storeRuntime(runtime);
        emitter.emitEvent({ slotId: runtime.slotId, threadId: runtime.threadId }, {
            type: 'turn_started',
            threadId: runtime.threadId,
            turnExecution: serializeSessionTurnExecution(runtime.turnExecution, {
                fieldName: 'chat message started event.turnExecution',
            }),
        });
        return {
            threadId: runtime.threadId,
            turnExecution: {
                ...runtime.turnExecution,
            },
        };
    }
    return {
        sendMessage,
    };
}
//# sourceMappingURL=chat-message.service.js.map