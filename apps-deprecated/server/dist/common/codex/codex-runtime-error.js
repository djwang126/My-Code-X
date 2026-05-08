import { cloneSessionError, cloneStructuredValue } from '@my-code-x/contracts';
function readHttpStatusCodeFromCodexErrorInfo(codexErrorInfo) {
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
    method;
    rpcCode;
    rpcData;
    raw;
    constructor({ message, method, code = null, data = null }) {
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
export function cloneCodexRuntimeError(error) {
    return cloneSessionError(error);
}
export function createCodexRuntimeError({ message, codexErrorInfo = null, additionalDetails = null, willRetry = null, threadId = null, turnId = null, presentationScope = 'shared', source = 'unknown', raw = null, }) {
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
export function createCodexRuntimeErrorFromTurnError({ error, willRetry = null, threadId = null, turnId = null, presentationScope = 'shared', source, }) {
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
export function createCodexRuntimeErrorFromRpcError({ error, method }) {
    return new CodexRequestError({
        message: error?.message || `codex app-server request failed: ${method}`,
        method,
        code: error?.code ?? null,
        data: error?.data ?? null,
    });
}
//# sourceMappingURL=codex-runtime-error.js.map