import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';

import { createStaticFileResponse } from './node-static-files.js';

describe('createStaticFileResponse', () => {
  test('serves index.html for root and app fallback routes', async () => {
    await withStaticRoot(async staticRoot => {
      const rootResponse = await createStaticFileResponse({
        config: { staticRoot },
        path: '/',
      });
      const fallbackResponse = await createStaticFileResponse({
        config: { staticRoot },
        path: '/threads/thread-1',
      });

      assert.equal(rootResponse.kind, 'file');
      assert.equal(fallbackResponse.kind, 'file');

      if (rootResponse.kind === 'file') {
        assert.equal(rootResponse.contentType, 'text/html; charset=utf-8');
        assert.equal(rootResponse.headers['cache-control'], 'no-cache');
      }
    });
  });

  test('serves assets with immutable cache headers', async () => {
    await withStaticRoot(async staticRoot => {
      const response = await createStaticFileResponse({
        config: { staticRoot },
        path: '/assets/index.js',
      });

      assert.equal(response.kind, 'file');

      if (response.kind === 'file') {
        assert.equal(response.contentType, 'text/javascript; charset=utf-8');
        assert.equal(response.headers['cache-control'], 'public, max-age=31536000, immutable');
      }
    });
  });

  test('returns not found for missing asset files', async () => {
    await withStaticRoot(async staticRoot => {
      const response = await createStaticFileResponse({
        config: { staticRoot },
        path: '/assets/missing.js',
      });

      assert.deepEqual(response, createErrorResponse({ statusCode: 404, message: 'Not found' }));
    });
  });

  test('does not fallback explicit static file requests to index.html', async () => {
    await withStaticRoot(async staticRoot => {
      const response = await createStaticFileResponse({
        config: { staticRoot },
        path: '/favicon.ico',
      });

      assert.deepEqual(response, createErrorResponse({ statusCode: 404, message: 'Not found' }));
    });
  });

  test('returns bad request for invalid encoded paths', async () => {
    await withStaticRoot(async staticRoot => {
      const response = await createStaticFileResponse({
        config: { staticRoot },
        path: '/%E0%A4%A',
      });

      assert.deepEqual(response, createErrorResponse({ statusCode: 400, message: 'Invalid request path' }));
    });
  });

  test('returns bad request for paths escaping static root', async () => {
    await withStaticRoot(async staticRoot => {
      const response = await createStaticFileResponse({
        config: { staticRoot },
        path: '/%2e%2e/secret.txt',
      });

      assert.deepEqual(response, createErrorResponse({ statusCode: 400, message: 'Invalid request path' }));
    });
  });
});

interface CreateErrorResponseInput {
  readonly statusCode: number;
  readonly message: string;
}

function createErrorResponse(input: CreateErrorResponseInput) {
  return {
    kind: 'json',
    statusCode: input.statusCode,
    headers: {},
    body: {
      error: {
        message: input.message,
      },
    },
  };
}

async function withStaticRoot(testBody: (staticRoot: string) => Promise<void>): Promise<void> {
  const staticRoot = await mkdtemp(path.join(os.tmpdir(), 'my-code-x-static-'));

  try {
    await mkdir(path.join(staticRoot, 'assets'));
    await writeFile(path.join(staticRoot, 'index.html'), '<div id="root"></div>', 'utf-8');
    await writeFile(path.join(staticRoot, 'assets', 'index.js'), 'console.log("ok");', 'utf-8');
    await testBody(staticRoot);
  } finally {
    await rm(staticRoot, {
      force: true,
      recursive: true,
    });
  }
}
