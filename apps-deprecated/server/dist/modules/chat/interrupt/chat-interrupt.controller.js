import { readJsonBodyOrSendError, sendJson, sendRouteError, sendValidationError } from '../../../common/http/route-helpers.js';
export async function handleChatInterruptRoute(request, response, { chatService }) {
    const body = await readJsonBodyOrSendError(request, response);
    if (!body) {
        return;
    }
    const slotId = String(body.slotId || '').trim();
    const threadId = String(body.threadId || '').trim();
    if (!slotId) {
        sendValidationError(response, 'slotId is required');
        return;
    }
    if (!threadId) {
        sendValidationError(response, 'threadId is required');
        return;
    }
    try {
        const result = await chatService.interruptTurn({ slotId, threadId });
        sendJson(response, 200, result);
    }
    catch (error) {
        sendRouteError(response, error);
    }
}
//# sourceMappingURL=chat-interrupt.controller.js.map