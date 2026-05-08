import { cloneSessionError, cloneStructuredValue } from '@my-code-x/contracts';
import type { LooseRecord } from './codex-types.js';
function readHttpStatusCodeFromCodexErrorInfo(codexErrorInfo: unknown) {
    if (!codexErrorInfo || typeof codexErrorInfo !== 'object' || Array.isArray(codexErrorInfo)) {
        return null;
    }
    const [variant] = Object.values(codexErrorInfo);
    if (!variant || typeof variant !== 'object' || Array.isArray(variant)) {
        return null;
    }
    return typeof variant.httpStatusCode === 'number' ? variant.httpStatusCode : null;
}
export class CodexRequestError extends Error {
    method: string;
    rpcCode: number | string | null;
    rpcData: LooseRecord | null;
    raw: LooseRecord;
    constructor({ message, method, code = null, data = null }: {
        message: string;
        method: string;
        code?: number | string | null;
        data?: LooseRecord | null;
    }) {
        super(message);
        this.name = 'CodexRequestError';
        this.method = method;
        this.rpcCode = code;
        this.rpcData = data;
        this.raw = {
            method,
            code,
            data,
        };
    }
}
export function cloneCodexRuntimeError(error: any) {
    return cloneSessionError(error);
}
export function createCodexRuntimeError({ message, codexErrorInfo = null, additionalDetails = null, willRetry = null, threadId = null, turnId = null, presentationScope = 'shared', source = 'unknown', raw = null, }: any) {
    return {
        message: typeof message === 'string' && message ? message : 'Codex error',
        codexErrorInfo,
        additionalDetails: typeof additionalDetails === 'string' && additionalDetails ? additionalDetails : null,
        httpStatusCode: readHttpStatusCodeFromCodexErrorInfo(codexErrorInfo),
        willRetry: typeof willRetry === 'boolean' ? willRetry : null,
        threadId: typeof threadId === 'string' && threadId ? threadId : null,
        turnId: typeof turnId === 'string' && turnId ? turnId : null,
        presentationScope,
        source,
        raw: cloneStructuredValue(raw),
    };
}
export function createCodexRuntimeErrorFromTurnError({ error, willRetry = null, threadId = null, turnId = null, presentationScope = 'shared', source, }: {
    error?: LooseRecord | null;
    willRetry?: boolean | null;
    threadId?: string | null;
    turnId?: string | null;
    presentationScope?: 'conversation' | 'shared';
    source: string;
}) {
    if (!error || typeof error !== 'object') {
        return null;
    }
    return createCodexRuntimeError({
        message: error.message,
        codexErrorInfo: error.codexErrorInfo ?? null,
        additionalDetails: error.additionalDetails ?? null,
        willRetry,
        threadId,
        turnId,
        presentationScope,
        source,
        raw: error,
    });
}
export function createCodexRuntimeErrorFromRpcError({ error, method }: {
    error?: LooseRecord | null;
    method: string;
}) {
    return new CodexRequestError({
        message: error?.message || `codex app-server request failed: ${method}`,
        method,
        code: error?.code ?? null,
        data: error?.data ?? null,
    });
}
