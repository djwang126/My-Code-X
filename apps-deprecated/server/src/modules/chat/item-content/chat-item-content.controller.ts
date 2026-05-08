import { getRequestUrl, sendJson, sendRouteError, sendValidationError } from '../../../common/http/route-helpers.js';
export async function handleChatItemContentRoute(request: any, response: any, { chatService }: any) {
    const url = getRequestUrl(request);
    const slotId = String(url.searchParams.get('slotId') || '').trim();
    const threadId = String(url.searchParams.get('threadId') || '').trim();
    const itemId = String(url.searchParams.get('itemId') || '').trim();
    if (!slotId) {
        sendValidationError(response, 'slotId is required');
        return;
    }
    if (!threadId) {
        sendValidationError(response, 'threadId is required');
        return;
    }
    if (!itemId) {
        sendValidationError(response, 'itemId is required');
        return;
    }
    try {
        const payload = await chatService.getTimelineItemContent({ slotId, threadId, itemId });
        sendJson(response, 200, payload);
    }
    catch (error) {
        sendRouteError(response, error);
    }
}
