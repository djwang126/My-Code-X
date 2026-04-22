import { readSessionTurnExecution } from '@my-code-x/contracts';

function createProbeHeaders(authToken) {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function readJsonResponse(response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Smoke probe expected JSON but received: ${text || '<empty>'}`);
  }
}

export async function waitForHealthyServer({
  port,
  authToken,
  fetchImpl = fetch,
  timeoutMs = 15_000,
  retryDelayMs = 500,
}) {
  const headers = createProbeHeaders(authToken);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetchImpl(`http://127.0.0.1:${port}/api/health`, { headers });
      if (response.ok) {
        const payload = await readJsonResponse(response);
        if (payload?.ok === true && payload.authRequired === Boolean(authToken)) {
          return payload;
        }
      }
    } catch {
      // retry
    }

    await sleep(retryDelayMs);
  }

  throw new Error(`Smoke health check failed for port ${port}.`);
}

export async function verifySessionBootstrapProbe({
  port,
  authToken,
  fetchImpl = fetch,
  viewerId = 'smoke-viewer',
  slotId = 'smoke-slot',
}) {
  const headers = createProbeHeaders(authToken);
  const query = new URLSearchParams({ viewerId, slotId });
  const response = await fetchImpl(`http://127.0.0.1:${port}/api/v2/session?${query.toString()}`, { headers });
  const payload = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(`Smoke session probe failed with status ${response.status}: ${JSON.stringify(payload)}`);
  }

  if (payload?.server?.ok !== true) {
    throw new Error('Smoke session probe failed: server.ok was not true.');
  }

  if (payload?.server?.authRequired !== Boolean(authToken)) {
    throw new Error('Smoke session probe failed: authRequired did not match the configured auth token state.');
  }

  if (payload?.viewer?.viewerId !== viewerId || payload?.viewer?.slotId !== slotId) {
    throw new Error('Smoke session probe failed: viewer echo did not match the probe request.');
  }

  if (payload?.session?.workspace !== '' || payload?.session?.threadId !== '') {
    throw new Error('Smoke session probe failed: expected an empty workspace/thread bootstrap.');
  }

  const turnExecution = readSessionTurnExecution(payload?.session?.turnExecution);

  if (!turnExecution) {
    throw new Error('Smoke session probe failed: expected session.turnExecution in the bootstrap payload.');
  }

  if (turnExecution.activeTurnId !== null || turnExecution.turnLifecycle !== 'idle') {
    throw new Error('Smoke session probe failed: expected an idle bootstrap session.');
  }

  if (payload?.stream?.url !== '') {
    throw new Error('Smoke session probe failed: expected an empty stream url.');
  }
}
