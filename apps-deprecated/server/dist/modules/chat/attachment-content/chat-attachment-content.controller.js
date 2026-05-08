import { getRequestUrl, sendValidationError, sendRouteError } from '../../../common/http/route-helpers.js';
export async function handleChatAttachmentContentRoute(request, response, { chatService, attachmentId }) {
    const url = getRequestUrl(request);
    const slotId = String(url.searchParams.get('slotId') || '').trim();
    const threadId = String(url.searchParams.get('threadId') || '').trim();
    if (!slotId) {
        sendValidationError(response, 'slotId is required');
        return;
    }
    if (!threadId) {
        sendValidationError(response, 'threadId is required');
        return;
    }
    try {
        const result = await chatService.getAttachmentContent({ attachmentId, slotId, threadId });
        response.writeHead(200, { 'Content-Type': result.contentType });
        response.end(result.body);
    }
    catch (error) {
        sendRouteError(response, error);
    }
}
//# sourceMappingURL=chat-attachment-content.controller.js.map