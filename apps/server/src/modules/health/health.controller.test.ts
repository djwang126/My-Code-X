import test from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../../app/app.js';
import { withServer } from '../../common/testing/http-test-helpers.js';

test('GET /api/health returns a smoke-compatible ok payload when authorized', async () => {
  const app = createApp({ authToken: 'smoke-auth', serverInstanceId: 'test-instance' });
  await withServer(app, async ({ port }) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
      headers: { Authorization: 'Bearer smoke-auth' },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      ok: true,
      authRequired: true,
      target: 'next',
      serverInstanceId: 'test-instance',
    });
  });
});
