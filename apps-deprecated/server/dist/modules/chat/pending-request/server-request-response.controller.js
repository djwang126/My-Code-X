import { readJsonBodyOrSendError, sendJson, sendRouteError, sendValidationError } from '../../../common/http/route-helpers.js';
export async function handleServerRequestResponseRoute(request, response, { chatService }) {
    const body = await readJsonBodyOrSendError(request, response);
    if (!body) {
        return;
    }
    const slotId = String(body?.slotId || '').trim();
    const threadId = String(body?.threadId ?? '').trim();
    const requestId = String(body?.requestId || '').trim();
    if (!slotId) {
        sendValidationError(response, 'slotId is required');
        return;
    }
    if (!requestId) {
        sendValidationError(response, 'requestId is required');
        return;
    }
    try {
        const result = await chatService.respondToPendingRequest({
            slotId,
            threadId,
            requestId,
            response: body?.response ?? {},
        });
        sendJson(response, 200, result);
    }
    catch (error) {
        sendRouteError(response, error);
    }
}
//# sourceMappingURL=server-request-response.controller.js.map