import { createChatMessageAcceptedPayload } from '../contracts/chat.contract.js';
import { readJsonBodyOrSendError, sendJson, sendRouteError, sendValidationError } from '../../../common/http/route-helpers.js';
import { normalizeMessageContent } from './chat-message-content.js';
const SEND_DEBUG_ENABLED = process.env.MY_CODE_X_DEBUG_STREAM_TIMING === '1' || process.env.MY_CODE_X_DEBUG_STREAM_TIMING === 'true';
function logSendDebug(stage, details = {}) {
    if (!SEND_DEBUG_ENABLED) {
        return;
    }
    const payload = {
        ts: new Date().toISOString(),
        scope: 'send',
        stage,
        ...details,
    };
    process.stdout.write(`[my-code-x-debug] ${JSON.stringify(payload)}\n`);
}
function splitRuntimeSettingsCollaborationMode(runtimeSettings) {
    if (!runtimeSettings || typeof runtimeSettings !== 'object' || Array.isArray(runtimeSettings)) {
        return {
            collaborationModeKind: undefined,
            runtimeSettings,
        };
    }
    const nextRuntimeSettings = { ...runtimeSettings };
    const collaborationModeKind = typeof nextRuntimeSettings.collaborationModeKind === 'string'
        ? nextRuntimeSettings.collaborationModeKind.trim() || undefined
        : undefined;
    delete nextRuntimeSettings.collaborationModeKind;
    return {
        collaborationModeKind,
        runtimeSettings: Object.keys(nextRuntimeSettings).length ? nextRuntimeSettings : undefined,
    };
}
export async function handleChatMessageRoute(request, response, { chatService }) {
    const body = await readJsonBodyOrSendError(request, response);
    if (!body) {
        return;
    }
    const viewerId = String(body.viewerId || '').trim();
    const slotId = String(body.slotId || '').trim();
    const workspace = String(body.workspace || '').trim();
    const threadId = String(body.threadId || '').trim();
    const text = String(body.text || '');
    const content = Array.isArray(body.content) ? body.content : undefined;
    const { collaborationModeKind, runtimeSettings } = splitRuntimeSettingsCollaborationMode(body.runtimeSettings);
    if (!viewerId) {
        sendValidationError(response, 'viewerId is required');
        return;
    }
    if (!slotId) {
        sendValidationError(response, 'slotId is required');
        return;
    }
    try {
        const normalizedContent = normalizeMessageContent({ text, content });
        const startedAt = Date.now();
        logSendDebug('request_received', {
            viewerId,
            slotId,
            workspace,
            threadId,
            contentCount: normalizedContent.length,
        });
        const firstContentItem = normalizedContent[0];
        const payload = {
            viewerId,
            slotId,
            workspace,
            ...(threadId ? { threadId } : {}),
            ...(content
                ? { content: normalizedContent }
                : { text: firstContentItem?.type === 'text' ? firstContentItem.text : text }),
            runtimeSettings,
            collaborationModeKind,
        };
        const result = await chatService.sendMessage(payload);
        logSendDebug('request_succeeded', {
            viewerId,
            slotId,
            workspace,
            threadId: result.threadId,
            turnId: result.turnExecution.activeTurnId,
            durationMs: Date.now() - startedAt,
        });
        sendJson(response, 200, createChatMessageAcceptedPayload({ slotId, result }));
    }
    catch (error) {
        logSendDebug('request_failed', {
            viewerId,
            slotId,
            workspace,
            threadId,
            error: error instanceof Error ? error.message : String(error),
        });
        sendRouteError(response, error);
    }
}
//# sourceMappingURL=chat-message.controller.js.map