export type SessionCodexErrorInfo =
  | 'contextWindowExceeded'
  | 'usageLimitExceeded'
  | 'serverOverloaded'
  | 'internalServerError'
  | 'unauthorized'
  | 'badRequest'
  | 'threadRollbackFailed'
  | 'sandboxError'
  | 'other'
  | { httpConnectionFailed: { httpStatusCode: number | null } }
  | { responseStreamConnectionFailed: { httpStatusCode: number | null } }
  | { responseStreamDisconnected: { httpStatusCode: number | null } }
  | { responseTooManyFailedAttempts: { httpStatusCode: number | null } }
  | { activeTurnNotSteerable: { turnKind: string } };

export type SessionErrorPresentationScope = 'conversation' | 'shared';

export type SessionError = {
  message: string;
  codexErrorInfo: SessionCodexErrorInfo | null;
  additionalDetails: string | null;
  httpStatusCode: number | null;
  willRetry: boolean | null;
  threadId: string | null;
  turnId: string | null;
  presentationScope: SessionErrorPresentationScope;
  source: string;
  raw: Record<string, unknown> | null;
};

export type SessionThreadStatus =
  | string
  | {
      type: string;
      activeFlags?: string[];
      [key: string]: unknown;
    };

export function cloneStructuredValue<T>(value: T): T {
  if (!value || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(entry => cloneStructuredValue(entry)) as T;
  }

  const objectValue = value as Record<string, unknown>;
  const clonedEntries = Object.entries(objectValue).map(([key, entry]) => [key, cloneStructuredValue(entry)]);
  return Object.fromEntries(clonedEntries) as T;
}

export function cloneSessionThreadStatus(threadStatus: SessionThreadStatus | null | undefined): SessionThreadStatus | null {
  if (!threadStatus) {
    return null;
  }

  if (typeof threadStatus !== 'object') {
    return threadStatus;
  }

  return cloneStructuredValue(threadStatus);
}

export function cloneSessionError(error: SessionError | null | undefined): SessionError | null {
  if (!error) {
    return null;
  }

  return {
    ...error,
    raw: cloneStructuredValue(error.raw),
  };
}
