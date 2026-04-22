import { getRequestUrl, sendJson, sendRouteError } from '../../../common/http/route-helpers.js';
export async function handleThreadHistoryRoute(request: any, response: any, { chatService }: any) {
    const url = getRequestUrl(request);
    const workspace = String(url.searchParams.get('workspace') || '').trim();
    const rawLimit = Number(url.searchParams.get('limit') || 20);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(50, Math.trunc(rawLimit))) : 20;
    try {
        const history = await chatService.listThreadHistory({ workspace, limit });
        sendJson(response, 200, { data: history });
    }
    catch (error) {
        sendRouteError(response, error);
    }
}
