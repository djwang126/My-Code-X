import { createHttpError, getHttpErrorStatusCode, serializeError } from '../errors/http-error.js';
export function getRequestUrl(request) {
    return new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`);
}
export function sendJson(response, statusCode, payload) {
    response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify(payload));
}
export function sendPlainText(response, statusCode, payload) {
    response.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(String(payload ?? ''));
}
export async function readJsonBody(request) {
    const chunks = [];
    for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const rawBody = Buffer.concat(chunks).toString('utf8');
    return rawBody ? JSON.parse(rawBody) : {};
}
export async function readJsonBodyOrSendError(request, response) {
    try {
        return await readJsonBody(request);
    }
    catch {
        sendRouteError(response, createHttpError('invalid json body', 400));
        return null;
    }
}
export function getTrimmedBodyString(body, key, fallback = '') {
    return String(body?.[key] || fallback).trim();
}
export function sendRouteError(response, error) {
    const statusCode = getHttpErrorStatusCode(error);
    sendJson(response, statusCode, serializeError(error, statusCode));
}
export function sendValidationError(response, message, statusCode = 400, code = undefined) {
    sendRouteError(response, createHttpError(message, statusCode, code));
}
//# sourceMappingURL=route-helpers.js.map