import type { AppRequest, AppResponse, JsonBody } from './http-types.js';
import { createHttpError, getHttpErrorStatusCode, serializeError } from '../errors/http-error.js';
export function getRequestUrl(request: AppRequest) {
    return new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`);
}
export function sendJson(response: AppResponse, statusCode: number, payload: unknown) {
    response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify(payload));
}
export function sendPlainText(response: AppResponse, statusCode: number, payload: unknown) {
    response.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(String(payload ?? ''));
}
export async function readJsonBody(request: AppRequest): Promise<JsonBody> {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const rawBody = Buffer.concat(chunks).toString('utf8');
    return rawBody ? (JSON.parse(rawBody) as JsonBody) : {};
}
export async function readJsonBodyOrSendError(request: AppRequest, response: AppResponse): Promise<JsonBody | null> {
    try {
        return await readJsonBody(request);
    }
    catch {
        sendRouteError(response, createHttpError('invalid json body', 400));
        return null;
    }
}
export function getTrimmedBodyString(body: JsonBody | null | undefined, key: string, fallback: any = '') {
    return String(body?.[key] || fallback).trim();
}
export function sendRouteError(response: AppResponse, error: unknown) {
    const statusCode = getHttpErrorStatusCode(error);
    sendJson(response, statusCode, serializeError(error, statusCode));
}
export function sendValidationError(response: AppResponse, message: string, statusCode: any = 400, code: string | undefined = undefined) {
    sendRouteError(response, createHttpError(message, statusCode, code));
}
