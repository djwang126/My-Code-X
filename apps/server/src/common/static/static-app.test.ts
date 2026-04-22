import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createApp } from '../../app/app.js';
import { withServer } from '../testing/http-test-helpers.js';

test('GET / serves the built apps/web shell when dist assets exist', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'my-code-x-static-'));
  const distDir = path.join(tempRoot, 'dist');
  const assetsDir = path.join(distDir, 'assets');
  await mkdir(assetsDir, { recursive: true });
  await writeFile(
    path.join(distDir, 'index.html'),
    '<!doctype html><html><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>',
  );
  await writeFile(path.join(assetsDir, 'app.js'), 'console.log("app shell");\n');

  const app = createApp({ authToken: '', serverInstanceId: 'static-test', frontendDistDir: distDir });
  try {
    await withServer(app, async ({ port }) => {
      const rootResponse = await fetch(`http://127.0.0.1:${port}/`);
      const rootHtml = await rootResponse.text();
      assert.equal(rootResponse.status, 200);
      assert.match(rootResponse.headers.get('content-type') || '', /text\/html/);
      assert.equal(rootResponse.headers.get('cache-control'), 'no-cache');
      assert.match(rootHtml, /<div id="root"><\/div>/);

      const assetResponse = await fetch(`http://127.0.0.1:${port}/assets/app.js`);
      const assetBody = await assetResponse.text();
      assert.equal(assetResponse.status, 200);
      assert.match(assetResponse.headers.get('content-type') || '', /javascript/);
      assert.equal(assetResponse.headers.get('cache-control'), 'public, max-age=31536000, immutable');
      assert.match(assetBody, /app shell/);
    });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('GET / remains public when API auth is enabled', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'my-code-x-static-auth-'));
  const distDir = path.join(tempRoot, 'dist');
  await mkdir(distDir, { recursive: true });
  await writeFile(
    path.join(distDir, 'index.html'),
    '<!doctype html><html><body><main>auth shell</main></body></html>',
  );

  const app = createApp({ authToken: 'secret', serverInstanceId: 'static-auth-test', frontendDistDir: distDir });
  try {
    await withServer(app, async ({ port }) => {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      const body = await response.text();
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type') || '', /text\/html/);
      assert.equal(response.headers.get('cache-control'), 'no-cache');
      assert.match(body, /auth shell/);
    });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('GET PWA support files uses explicit content types and cache policies', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'my-code-x-static-pwa-'));
  const distDir = path.join(tempRoot, 'dist');
  const assetsDir = path.join(distDir, 'assets');
  await mkdir(assetsDir, { recursive: true });
  await writeFile(path.join(distDir, 'index.html'), '<!doctype html><html><body>PWA shell</body></html>');
  await writeFile(path.join(distDir, 'manifest.webmanifest'), '{"name":"My Code X"}');
  await writeFile(path.join(distDir, 'registerSW.js'), 'console.log("sw register");\n');
  await writeFile(path.join(assetsDir, 'mask-icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>');

  const app = createApp({ authToken: '', serverInstanceId: 'static-pwa-test', frontendDistDir: distDir });
  try {
    await withServer(app, async ({ port }) => {
      const manifestResponse = await fetch(`http://127.0.0.1:${port}/manifest.webmanifest`);
      assert.equal(manifestResponse.status, 200);
      assert.equal(manifestResponse.headers.get('content-type'), 'application/manifest+json; charset=utf-8');
      assert.equal(manifestResponse.headers.get('cache-control'), 'public, max-age=3600');

      const swRegisterResponse = await fetch(`http://127.0.0.1:${port}/registerSW.js`);
      assert.equal(swRegisterResponse.status, 200);
      assert.match(swRegisterResponse.headers.get('content-type') || '', /javascript/);
      assert.equal(swRegisterResponse.headers.get('cache-control'), 'no-cache');

      const iconResponse = await fetch(`http://127.0.0.1:${port}/assets/mask-icon.svg`);
      assert.equal(iconResponse.status, 200);
      assert.equal(iconResponse.headers.get('content-type'), 'image/svg+xml; charset=utf-8');
      assert.equal(iconResponse.headers.get('cache-control'), 'public, max-age=31536000, immutable');
    });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
