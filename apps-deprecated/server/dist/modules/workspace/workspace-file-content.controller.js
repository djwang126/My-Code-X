import { getRequestUrl, sendRouteError } from '../../common/http/route-helpers.js';
export async function handleWorkspaceFileContentRoute(request, response, { workspaceFilesService }) {
    const url = getRequestUrl(request);
    const workspace = String(url.searchParams.get('workspace') || '').trim();
    const path = String(url.searchParams.get('path') || '').trim();
    try {
        const result = await workspaceFilesService.readFileContent({ workspace, path });
        response.writeHead(200, { 'Content-Type': result.contentType });
        response.end(result.body);
    }
    catch (error) {
        sendRouteError(response, error);
    }
}
//# sourceMappingURL=workspace-file-content.controller.js.map