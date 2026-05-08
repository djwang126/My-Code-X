import { normalizeErrorCode } from '@my-code-x/utils/error-code';

type ErrorPayload = {
  error?: {
    code?: unknown;
    message?: unknown;
    status?: unknown;
  };
};

export class SessionApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor({ message, code, status }: { message: string; code: string; status: number }) {
    super(message);
    this.name = 'SessionApiError';
    this.code = code;
    this.status = status;
  }
}

export async function readApiError(response: Response) {
  const status = response.status;
  const rawBody = await response.text();
  let payload = null;

  if (rawBody) {
    try {
      payload = JSON.parse(rawBody) as ErrorPayload;
    } catch {
      payload = null;
    }
  }

  const message =
    typeof payload?.error?.message === 'string' && payload.error.message.trim()
      ? payload.error.message
      : rawBody || response.statusText || String(status);
  const code =
    typeof payload?.error?.code === 'string' && payload.error.code.trim()
      ? payload.error.code
      : normalizeErrorCode(message, status === 401 ? 'unauthorized' : 'unknown_error');
  return new SessionApiError({ message, code, status });
}

export async function ensureOk(response: Response) {
  if (!response.ok) {
    throw await readApiError(response);
  }
}

function sleep(delayMs: number) {
  return new Promise(resolve => setTimeout(resolve, delayMs));
}

export async function postJson<Payload>({
  url,
  body,
  parseResponse,
}: {
  url: string;
  body: Record<string, unknown>;
  parseResponse?: (payload: unknown) => Payload;
}): Promise<Payload> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  });

  await ensureOk(response);

  const payload = await response.json();
  return parseResponse ? parseResponse(payload) : (payload as Payload);
}

export async function waitForHealthResponse({
  healthUrl,
  intervalMs,
  timeoutMs,
  previousServerInstanceId,
}: {
  healthUrl: string;
  intervalMs: number;
  timeoutMs: number;
  previousServerInstanceId: string;
}): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (true) {
    try {
      const response = await fetch(`${healthUrl}?t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      if (response.ok) {
        if (!previousServerInstanceId) {
          return;
        }

        const payload = (await response.json().catch(() => null)) as { serverInstanceId?: unknown } | null;
        const nextServerInstanceId =
          typeof payload?.serverInstanceId === 'string' ? payload.serverInstanceId.trim() : '';

        if (nextServerInstanceId && nextServerInstanceId !== previousServerInstanceId) {
          return;
        }
      }
    } catch {
      // Keep polling until the replacement instance is reachable.
    }

    if (Date.now() >= deadline) {
      throw new Error('Timed out waiting for My-Code-X to come back online.');
    }

    await sleep(intervalMs);
  }
}

