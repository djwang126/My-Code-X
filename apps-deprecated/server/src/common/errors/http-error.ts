import { normalizeErrorCode } from '@my-code-x/utils/error-code';
export class HttpError extends Error {
    statusCode: number;
    code: string;
    constructor(message: string, statusCode: number, code: string | undefined = undefined) {
        super(message);
        this.name = 'HttpError';
        this.statusCode = statusCode;
        this.code = typeof code === 'string' && code.trim() ? code.trim() : normalizeErrorCode(message);
    }
}
export function createHttpError(message: string, statusCode: number, code: string | undefined = undefined) {
    return new HttpError(message, statusCode, code);
}
export function getHttpErrorStatusCode(error: any, fallbackStatusCode: any = 502) {
    return typeof error?.statusCode === 'number' && Number.isInteger(error.statusCode)
        ? error.statusCode
        : fallbackStatusCode;
}
export function getErrorCode(error: any, fallbackCode: any = 'internal_error') {
    if (typeof error?.code === 'string' && error.code.trim()) {
        return error.code.trim();
    }
    if (error instanceof Error && error.message) {
        return normalizeErrorCode(error.message);
    }
    return fallbackCode;
}
export function serializeError(error: any, fallbackStatusCode: any = 502) {
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
