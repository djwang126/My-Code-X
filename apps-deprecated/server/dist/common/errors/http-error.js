import { normalizeErrorCode } from '@my-code-x/utils/error-code';
export class HttpError extends Error {
    statusCode;
    code;
    constructor(message, statusCode, code = undefined) {
        super(message);
        this.name = 'HttpError';
        this.statusCode = statusCode;
        this.code = typeof code === 'string' && code.trim() ? code.trim() : normalizeErrorCode(message);
    }
}
export function createHttpError(message, statusCode, code = undefined) {
    return new HttpError(message, statusCode, code);
}
export function getHttpErrorStatusCode(error, fallbackStatusCode = 502) {
    return typeof error?.statusCode === 'number' && Number.isInteger(error.statusCode)
        ? error.statusCode
        : fallbackStatusCode;
}
export function getErrorCode(error, fallbackCode = 'internal_error') {
    if (typeof error?.code === 'string' && error.code.trim()) {
        return error.code.trim();
    }
    if (error instanceof Error && error.message) {
        return normalizeErrorCode(error.message);
    }
    return fallbackCode;
}
export function serializeError(error, fallbackStatusCode = 502) {
    const status = getHttpErrorStatusCode(error, fallbackStatusCode);
    const message = error instanceof Error ? error.message : String(error);
    return {
        error: {
            code: getErrorCode(error),
            message,
            status,
        },
    };
}
//# sourceMappingURL=http-error.js.map