import Busboy from 'busboy';
import { sendJson, sendRouteError } from '../../../common/http/route-helpers.js';
import { createHttpError } from '../../../common/errors/http-error.js';
import { RAW_UPLOAD_LIMIT_BYTES } from '../attachments/attachment-limits.js';
import type { LooseRecord } from '../../../common/codex/codex-types.js';
function readMultipartFile(request: any) {
    return new Promise<{
        filename: string;
        contentType: string;
        buffer: Buffer;
        fields: Record<string, string>;
    }>((resolve: any, reject: any) => {
        const busboy = Busboy({
            headers: request.headers,
            limits: {
                files: 1,
                fileSize: RAW_UPLOAD_LIMIT_BYTES,
            },
        });
        let settled = false;
        let resolved = false;
        const fields: Record<string, string> = {};
        let uploadTooLarge = false;
        function rejectOnce(error: any) {
            if (settled) {
                return;
            }
            settled = true;
            reject(error);
        }
        function resolveOnce(payload: any) {
            if (settled) {
                return;
            }
            settled = true;
            resolve(payload);
        }
        busboy.on('file', (_fieldName: any, file: any, info: any) => {
            const chunks: any[] = [];
            file.on('data', (chunk: any) => {
                if (uploadTooLarge) {
                    return;
                }
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            });
            file.on('limit', () => {
                uploadTooLarge = true;
                file.resume();
                rejectOnce(createHttpError('attachment_upload_too_large', 413, 'attachment_upload_too_large'));
            });
            file.on('end', () => {
                if (resolved || uploadTooLarge) {
                    return;
                }
                resolved = true;
                resolveOnce({
                    filename: info.filename || 'attachment',
                    contentType: info.mimeType || 'application/octet-stream',
                    buffer: Buffer.concat(chunks),
                    fields,
                });
            });
        });
        busboy.on('field', (fieldName: any, value: any) => {
            fields[fieldName] = value;
        });
        busboy.on('filesLimit', () => {
            rejectOnce(createHttpError('only one file per upload is supported', 400, 'attachment_upload_file_limit_exceeded'));
        });
        busboy.on('finish', () => {
            if (!resolved && !uploadTooLarge && !settled) {
                rejectOnce(createHttpError('file is required', 400, 'file_is_required'));
            }
        });
        busboy.on('error', rejectOnce);
        request.pipe(busboy);
    });
}
export async function handleChatAttachmentUploadRoute(request: any, response: any, { chatService }: {
    chatService: LooseRecord;
}) {
    try {
        const upload = await readMultipartFile(request);
        if (!upload.contentType.startsWith('image/')) {
            throw createHttpError('only image attachments are supported', 400, 'unsupported_attachment_type');
        }
        const slotId = typeof upload.fields?.slotId === 'string' ? upload.fields.slotId.trim() : '';
        const threadId = typeof upload.fields?.threadId === 'string' ? upload.fields.threadId.trim() : '';
        if (!slotId) {
            throw createHttpError('slotId is required', 400, 'slotid_is_required');
        }
        const runtime = typeof chatService.getSessionState === 'function'
            ? chatService.getSessionState({ slotId, threadId })
            : null;
        if (!runtime) {
            throw createHttpError('attachment_session_not_found', 404, 'attachment_session_not_found');
        }
        const result = await chatService.uploadAttachment({
            filename: upload.filename,
            contentType: upload.contentType,
            buffer: upload.buffer,
            viewerId: runtime.viewerId,
            threadId: runtime.threadId || '',
        });
        sendJson(response, 200, result);
    }
    catch (error) {
        sendRouteError(response, error);
    }
}
