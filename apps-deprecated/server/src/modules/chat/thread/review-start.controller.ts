import { getTrimmedBodyString, readJsonBodyOrSendError, sendJson, sendRouteError, sendValidationError } from '../../../common/http/route-helpers.js';
export async function handleReviewStartRoute(request: any, response: any, { chatService }: any) {
    const body = await readJsonBodyOrSendError(request, response);
    if (!body) {
        return;
    }
    const slotId = getTrimmedBodyString(body, 'slotId');
    const threadId = getTrimmedBodyString(body, 'threadId');
    const workspace = getTrimmedBodyString(body, 'workspace');
    const delivery = getTrimmedBodyString(body, 'delivery', 'inline') || 'inline';
    const target = body.target;
    if (!slotId) {
        sendValidationError(response, 'slotId is required');
        return;
    }
    if (!threadId) {
        sendValidationError(response, 'threadId is required');
        return;
    }
    if (!target || typeof target !== 'object') {
        sendValidationError(response, 'target is required');
        return;
    }
    try {
        const result = await chatService.startReview({ slotId, threadId, workspace, delivery, target });
        sendJson(response, 200, result);
    }
    catch (error) {
        sendRouteError(response, error);
    }
}
