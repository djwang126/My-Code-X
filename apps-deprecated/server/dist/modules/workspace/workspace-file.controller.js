import { getTrimmedBodyString, getRequestUrl, readJsonBodyOrSendError, sendJson, sendRouteError } from '../../common/http/route-helpers.js';
export async function handleWorkspaceFileReadRoute(request, response, { workspaceFilesService }) {
    const url = getRequestUrl(request);
    const workspace = String(url.searchParams.get('workspace') || '').trim();
    const path = String(url.searchParams.get('path') || '').trim();
    const full = url.searchParams.get('full') === '1';
    try {
        const file = await workspaceFilesService.readFile({ workspace, path, full });
        sendJson(response, 200, file);
    }
    catch (error) {
        sendRouteError(response, error);
    }
}
export async function handleWorkspaceFileSaveRoute(request, response, { workspaceFilesService }) {
    const body = await readJsonBodyOrSendError(request, response);
    if (!body) {
        return;
    }
    const workspace = getTrimmedBodyString(body, 'workspace');
    const path = getTrimmedBodyString(body, 'path');
    const content = typeof body?.content === 'string' ? body.content : '';
    try {
        const result = await workspaceFilesService.saveFile({ workspace, path, content });
        sendJson(response, 200, result);
    }
    catch (error) {
        sendRouteError(response, error);
    }
}
//# sourceMappingURL=workspace-file.controller.js.map