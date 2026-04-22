import { getTrimmedBodyString, readJsonBodyOrSendError, sendJson, sendRouteError, sendValidationError } from '../../../common/http/route-helpers.js';
export async function handleThreadForkRoute(request: any, response: any, { chatService }: any) {
    const body = await readJsonBodyOrSendError(request, response);
    if (!body) {
        return;
    }
    const slotId = getTrimmedBodyString(body, 'slotId');
    const threadId = getTrimmedBodyString(body, 'threadId');
    const workspace = getTrimmedBodyString(body, 'workspace');
    const preservedTurnCount = Number(body?.preservedTurnCount);
    if (!slotId) {
        sendValidationError(response, 'slotId is required');
        return;
    }
    if (!threadId) {
        sendValidationError(response, 'threadId is required');
        return;
    }
    if (!Number.isInteger(preservedTurnCount) || preservedTurnCount < 1) {
        sendValidationError(response, 'preservedTurnCount must be a positive integer');
        return;
    }
    try {
        const result = await chatService.forkThread({ slotId, threadId, workspace, preservedTurnCount });
        sendJson(response, 200, result);
    }
    catch (error) {
        sendRouteError(response, error);
    }
}
