import { getRequestUrl, sendJson, sendRouteError } from '../../common/http/route-helpers.js';
export async function handleWorkspaceFilesRoute(request, response, { workspaceFilesService }) {
    const url = getRequestUrl(request);
    const workspace = String(url.searchParams.get('workspace') || '').trim();
    const path = String(url.searchParams.get('path') || '').trim();
    try {
        const data = await workspaceFilesService.listFiles({ workspace, path });
        sendJson(response, 200, { data });
    }
    catch (error) {
        sendRouteError(response, error);
    }
}
//# sourceMappingURL=workspace-files.controller.js.map