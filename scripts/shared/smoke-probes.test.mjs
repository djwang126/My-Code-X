import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

import { verifySessionBootstrapProbe, waitForHealthyServer } from './smoke-probes.mjs';

async function withProbeServer(handler, run) {
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();

  try {
    await run({ port: address.port });
  } finally {
    await new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
  }
}

test('waitForHealthyServer accepts a healthy backend probe response', async () => {
  await withProbeServer((request, response) => {
    assert.equal(request.url, '/api/health');
    assert.equal(request.headers.authorization, 'Bearer smoke-token');
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ ok: true, authRequired: true }));
  }, async ({ port }) => {
    await assert.doesNotReject(() => waitForHealthyServer({ port, authToken: 'smoke-token' }));
  });
});

test('verifySessionBootstrapProbe accepts an empty idle bootstrap payload', async () => {
  await withProbeServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');

    assert.equal(url.pathname, '/api/v2/session');
    assert.equal(request.headers.authorization, 'Bearer smoke-token');
    assert.equal(url.searchParams.get('viewerId'), 'smoke-viewer');
    assert.equal(url.searchParams.get('slotId'), 'smoke-slot');

    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(
      JSON.stringify({
        server: { ok: true, authRequired: true },
        viewer: { viewerId: 'smoke-viewer', slotId: 'smoke-slot' },
        session: {
          workspace: '',
          threadId: '',
          turnExecution: {
            activeTurnId: null,
            turnLifecycle: 'idle',
          },
        },
        stream: { url: '' },
      }),
    );
  }, async ({ port }) => {
    await assert.doesNotReject(() => verifySessionBootstrapProbe({ port, authToken: 'smoke-token' }));
  });
});

test('verifySessionBootstrapProbe rejects a non-idle bootstrap payload', async () => {
  await withProbeServer((request, response) => {
    void request;
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(
      JSON.stringify({
        server: { ok: true, authRequired: false },
        viewer: { viewerId: 'smoke-viewer', slotId: 'smoke-slot' },
        session: {
          workspace: '',
          threadId: 'thread-1',
          turnExecution: {
            activeTurnId: 'turn-1',
            turnLifecycle: 'running',
          },
        },
        stream: { url: '/api/v2/chat/events?slotId=smoke-slot&threadId=thread-1' },
      }),
    );
  }, async ({ port }) => {
    await assert.rejects(
      () => verifySessionBootstrapProbe({ port, authToken: '' }),
      error =>
        error instanceof Error &&
        error.message === 'Smoke session probe failed: expected an empty workspace/thread bootstrap.',
    );
  });
});

test('verifySessionBootstrapProbe rejects a bootstrap payload without session.turnExecution', async () => {
  await withProbeServer((request, response) => {
    void request;
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(
      JSON.stringify({
        server: { ok: true, authRequired: false },
        viewer: { viewerId: 'smoke-viewer', slotId: 'smoke-slot' },
        session: {
          workspace: '',
          threadId: '',
        },
        stream: { url: '' },
      }),
    );
  }, async ({ port }) => {
    await assert.rejects(
      () => verifySessionBootstrapProbe({ port, authToken: '' }),
      error =>
        error instanceof Error &&
        error.message === 'Smoke session probe failed: expected session.turnExecution in the bootstrap payload.',
    );
  });
});
