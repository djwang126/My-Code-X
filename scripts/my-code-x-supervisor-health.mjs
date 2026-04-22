import { buildHttpUrl } from './my-code-x-exposure.mjs';

export async function fetchWithTimeout(url, options = {}, timeoutMs = 3_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export function buildBackendHealthRequestOptions(authToken = '') {
  const trimmedToken = String(authToken || '').trim();
  if (!trimmedToken) {
    return {};
  }

  return {
    headers: {
      authorization: `Bearer ${trimmedToken}`,
    },
  };
}

export function describeTimedFetchError(error, timeoutMs, action) {
  if (error?.name === 'AbortError') {
    return `${action} timed out after ${timeoutMs}ms`;
  }

  return error instanceof Error ? error.message : String(error);
}

export function getLocalBaseUrlFromState(state) {
  if (typeof state?.localUrl === 'string' && state.localUrl.trim()) {
    return state.localUrl;
  }

  if (state?.backend?.host && state?.backend?.port) {
    return buildHttpUrl(state.backend.host, state.backend.port);
  }

  return '';
}

export async function probeBackendHealth(
  state,
  {
    authToken = '',
    timeoutMs = 1_000,
    fetchWithTimeoutImpl = fetchWithTimeout,
  } = {},
) {
  const baseUrl = getLocalBaseUrlFromState(state);

  if (!baseUrl) {
    return {
      ok: false,
      error: 'backend health url unavailable',
    };
  }

  const healthUrl = new URL('/api/health', baseUrl).toString();

  try {
    const response = await fetchWithTimeoutImpl(healthUrl, buildBackendHealthRequestOptions(authToken), timeoutMs);
    if (!response.ok) {
      return {
        ok: false,
        error: `backend health check failed with status ${response.status}`,
      };
    }

    const payload = await response.json().catch(() => null);
    if (!payload?.ok) {
      return {
        ok: false,
        error: 'backend health check returned an invalid payload',
      };
    }

    return {
      ok: true,
      serverInstanceId:
        typeof payload.serverInstanceId === 'string' && payload.serverInstanceId.trim()
          ? payload.serverInstanceId.trim()
          : `unknown-${Date.now()}`,
    };
  } catch (error) {
    return {
      ok: false,
      error: describeTimedFetchError(error, timeoutMs, 'backend health check'),
    };
  }
}

export async function reflectLiveBackendStatus(
  state,
  {
    authToken = '',
    timeoutMs = 1_000,
    isProcessRunning,
    probeBackendHealthImpl = probeBackendHealth,
  } = {},
) {
  if (!state?.backend?.pid || !state.backend.serverInstanceId || ['failed', 'stopped', 'stopping'].includes(state.status)) {
    return state;
  }

  if (!isProcessRunning(state.backend.pid)) {
    return {
      ...state,
      status: 'degraded',
      lastError: 'backend process is not running',
    };
  }

  const health = await probeBackendHealthImpl(state, { authToken, timeoutMs });
  if (health.ok) {
    return state;
  }

  return {
    ...state,
    status: 'degraded',
    lastError: health.error,
  };
}
