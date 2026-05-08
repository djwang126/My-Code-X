import { createHttpError } from '../../common/errors/http-error.js';
import { getTrimmedBodyString, readJsonBodyOrSendError, sendJson, sendRouteError, sendValidationError } from '../../common/http/route-helpers.js';
export async function handleAppRestartRoute(request, response, { restartHandler }) {
    const body = await readJsonBodyOrSendError(request, response);
    if (!body) {
        return;
    }
    const viewerId = getTrimmedBodyString(body, 'viewerId');
    const slotId = getTrimmedBodyString(body, 'slotId');
    const workspace = getTrimmedBodyString(body, 'workspace');
    const threadId = getTrimmedBodyString(body, 'threadId');
    if (!viewerId) {
        sendValidationError(response, 'viewerId is required');
        return;
    }
    if (!slotId) {
        sendValidationError(response, 'slotId is required');
        return;
    }
    if (typeof restartHandler !== 'function') {
        sendRouteError(response, createHttpError('restart unavailable', 503));
        return;
    }
    try {
        const result = await restartHandler({ viewerId, slotId, workspace, threadId });
        sendJson(response, 200, result);
    }
    catch (error) {
        sendRouteError(response, error);
    }
}
//# sourceMappingURL=app-restart.controller.js.map