import type { AppRequest, AppResponse } from '../../common/http/http-types.js';
import { getRequestUrl, sendJson, sendRouteError, sendValidationError } from '../../common/http/route-helpers.js';

interface SessionServiceLike {
  getSessionBootstrap(input: {
    viewerId: string;
    slotId: string;
    workspace?: string;
    threadId?: string;
  }): Promise<unknown>;
}

export async function handleSessionRoute(
  request: AppRequest,
  response: AppResponse,
  { sessionService }: { sessionService: SessionServiceLike },
) {
  const url = getRequestUrl(request);
  const viewerId = String(url.searchParams.get('viewerId') || '').trim();
  const slotId = String(url.searchParams.get('slotId') || '').trim();
  const workspace = String(url.searchParams.get('workspace') || '').trim();
  const threadId = String(url.searchParams.get('threadId') || '').trim();

  if (!viewerId) {
    sendValidationError(response, 'viewerId is required');
    return;
  }

  if (!slotId) {
    sendValidationError(response, 'slotId is required');
    return;
  }

  try {
    const payload = await sessionService.getSessionBootstrap({ viewerId, slotId, workspace, threadId });
    sendJson(response, 200, payload);
  } catch (error) {
    sendRouteError(response, error);
  }
}
