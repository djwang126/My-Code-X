import { getTrimmedBodyString, readJsonBodyOrSendError, sendJson, sendRouteError, sendValidationError } from '../../../common/http/route-helpers.js';
export async function handleThreadCompactRoute(request: any, response: any, { chatService }: any) {
    const body = await readJsonBodyOrSendError(request, response);
    if (!body) {
        return;
    }
    const slotId = getTrimmedBodyString(body, 'slotId');
    const threadId = getTrimmedBodyString(body, 'threadId');
    const workspace = getTrimmedBodyString(body, 'workspace');
    if (!slotId) {
        sendValidationError(response, 'slotId is required');
        return;
    }
    if (!threadId) {
        sendValidationError(response, 'threadId is required');
        return;
    }
    try {
        const result = await chatService.compactThread({ slotId, threadId, workspace });
        sendJson(response, 200, result);
    }
    catch (error) {
        sendRouteError(response, error);
    }
}
