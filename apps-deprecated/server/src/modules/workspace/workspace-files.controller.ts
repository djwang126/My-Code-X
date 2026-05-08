import type { AppRequest, AppResponse } from '../../common/http/http-types.js';
import { getRequestUrl, sendJson, sendRouteError } from '../../common/http/route-helpers.js';

interface WorkspaceFilesServiceLike {
  listFiles(input: { workspace: string; path?: string }): Promise<unknown>;
}

export async function handleWorkspaceFilesRoute(
  request: AppRequest,
  response: AppResponse,
  { workspaceFilesService }: { workspaceFilesService: WorkspaceFilesServiceLike },
) {
  const url = getRequestUrl(request);
  const workspace = String(url.searchParams.get('workspace') || '').trim();
  const path = String(url.searchParams.get('path') || '').trim();

  try {
    const data = await workspaceFilesService.listFiles({ workspace, path });
    sendJson(response, 200, { data });
  } catch (error) {
    sendRouteError(response, error);
  }
}

