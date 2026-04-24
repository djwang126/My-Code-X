import { handleChatAttachmentContentRoute } from './attachment-content/index.js';
import { handleChatAttachmentUploadRoute } from './attachment-upload/index.js';
import { handleChatEventsRoute } from './events/index.js';
import { handleChatInterruptRoute } from './interrupt/index.js';
import { handleChatItemContentRoute } from './item-content/index.js';
import { handleChatMessageRoute } from './message/index.js';
import { handleServerRequestResponseRoute } from './pending-request/index.js';
import {
    handleReviewStartRoute,
    handleThreadCompactRoute,
    handleThreadForkRoute,
    handleThreadHistoryRoute,
    handleThreadResumeRoute,
    handleThreadRollbackRoute,
    handleThreadStartRoute,
} from './thread/index.js';
function readAttachmentContentId(pathname: any) {
    const match = pathname.match(/^\/api\/v2\/chat\/attachments\/([^/]+)\/content$/);
    return match ? decodeURIComponent(match[1]) : '';
}
export async function tryHandleChatRoutes(request: any, response: any, { url, chatService }: any) {
    const attachmentId = readAttachmentContentId(url.pathname);
    if (request.method === 'POST' && url.pathname === '/api/v2/chat/attachments') {
        await handleChatAttachmentUploadRoute(request, response, { chatService });
        return true;
    }
    if (request.method === 'GET' && attachmentId) {
        await handleChatAttachmentContentRoute(request, response, { chatService, attachmentId });
        return true;
    }
    if (request.method === 'GET' && url.pathname === '/api/v2/thread/history') {
        await handleThreadHistoryRoute(request, response, { chatService });
        return true;
    }
    if (request.method === 'POST' && url.pathname === '/api/v2/chat/message') {
        await handleChatMessageRoute(request, response, { chatService });
        return true;
    }
    if (request.method === 'POST' && url.pathname === '/api/v2/chat/interrupt') {
        await handleChatInterruptRoute(request, response, { chatService });
        return true;
    }
    if (request.method === 'POST' && url.pathname === '/api/v2/thread/compact') {
        await handleThreadCompactRoute(request, response, { chatService });
        return true;
    }
    if (request.method === 'POST' && url.pathname === '/api/v2/thread/start') {
        await handleThreadStartRoute(request, response, { chatService });
        return true;
    }
    if (request.method === 'POST' && url.pathname === '/api/v2/thread/resume') {
        await handleThreadResumeRoute(request, response, { chatService });
        return true;
    }
    if (request.method === 'POST' && url.pathname === '/api/v2/thread/rollback') {
        await handleThreadRollbackRoute(request, response, { chatService });
        return true;
    }
    if (request.method === 'POST' && url.pathname === '/api/v2/thread/fork') {
        await handleThreadForkRoute(request, response, { chatService });
        return true;
    }
    if (request.method === 'POST' && url.pathname === '/api/v2/review/start') {
        await handleReviewStartRoute(request, response, { chatService });
        return true;
    }
    if (request.method === 'POST' && url.pathname === '/api/v2/server-requests/respond') {
        await handleServerRequestResponseRoute(request, response, { chatService });
        return true;
    }
    if (request.method === 'GET' && url.pathname === '/api/v2/chat/events') {
        handleChatEventsRoute(request, response, { chatService });
        return true;
    }
    if (request.method === 'GET' && url.pathname === '/api/v2/chat/item-content') {
        await handleChatItemContentRoute(request, response, { chatService });
        return true;
    }
    return false;
}
