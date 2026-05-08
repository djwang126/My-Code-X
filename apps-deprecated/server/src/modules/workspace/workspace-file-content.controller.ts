import type { AppRequest, AppResponse } from '../../common/http/http-types.js';
import { getRequestUrl, sendRouteError } from '../../common/http/route-helpers.js';

interface WorkspaceFilesServiceLike {
  readFileContent(input: { workspace: string; path: string }): Promise<{ body: Buffer; contentType: string }>;
}

export async function handleWorkspaceFileContentRoute(
  request: AppRequest,
  response: AppResponse,
  { workspaceFilesService }: { workspaceFilesService: WorkspaceFilesServiceLike },
) {
  const url = getRequestUrl(request);
  const workspace = String(url.searchParams.get('workspace') || '').trim();
  const path = String(url.searchParams.get('path') || '').trim();

  try {
    const result = await workspaceFilesService.readFileContent({ workspace, path });
    response.writeHead(200, { 'Content-Type': result.contentType });
    response.end(result.body);
  } catch (error) {
    sendRouteError(response, error);
  }
}
