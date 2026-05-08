import { createHttpError } from '../../common/errors/http-error.js';
import { getTrimmedBodyString, readJsonBodyOrSendError, sendJson, sendRouteError, sendValidationError } from '../../common/http/route-helpers.js';
export async function handleAppRestartShutdownRoute(request, response, { restartShutdownHandler }) {
    const body = await readJsonBodyOrSendError(request, response);
    if (!body) {
        return;
    }
    const token = getTrimmedBodyString(body, 'token');
    if (!token) {
        sendValidationError(response, 'token is required');
        return;
    }
    if (typeof restartShutdownHandler !== 'function') {
        sendRouteError(response, createHttpError('restart shutdown unavailable', 503));
        return;
    }
    try {
        const result = await restartShutdownHandler({ token });
        sendJson(response, 200, result);
    }
    catch (error) {
        sendRouteError(response, error);
    }
}
//# sourceMappingURL=app-restart-shutdown.controller.js.map