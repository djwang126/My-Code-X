import { getTrimmedBodyString, readJsonBodyOrSendError, sendJson, sendRouteError, sendValidationError } from '../../../common/http/route-helpers.js';
export async function handleThreadRollbackRoute(request, response, { chatService }) {
    const body = await readJsonBodyOrSendError(request, response);
    if (!body) {
        return;
    }
    const slotId = getTrimmedBodyString(body, 'slotId');
    const threadId = getTrimmedBodyString(body, 'threadId');
    const workspace = getTrimmedBodyString(body, 'workspace');
    const numTurns = Number(body?.numTurns);
    if (!slotId) {
        sendValidationError(response, 'slotId is required');
        return;
    }
    if (!threadId) {
        sendValidationError(response, 'threadId is required');
        return;
    }
    if (!Number.isInteger(numTurns) || numTurns < 1) {
        sendValidationError(response, 'numTurns must be a positive integer');
        return;
    }
    try {
        const result = await chatService.rollbackThread({ slotId, threadId, workspace, numTurns });
        sendJson(response, 200, result);
    }
    catch (error) {
        sendRouteError(response, error);
    }
}
//# sourceMappingURL=thread-rollback.controller.js.map