import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createApp } from '../../app/app.js';
import { withServer } from '../../common/testing/http-test-helpers.js';

async function withWorkspace(run: (input: { workspace: string }) => Promise<void>) {
  const workspace = await mkdtemp(join(tmpdir(), 'my-code-x-workspace-'));

  try {
    await run({ workspace });
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

async function fetchWorkspaceJson({
  port,
  path,
  workspace,
}: {
  port: number;
  path: string;
  workspace: string;
}) {
  const search = new URLSearchParams({ workspace, path });
  const response = await fetch(`http://127.0.0.1:${port}/api/v2/workspace/file?${search.toString()}`, {
    headers: { Authorization: 'Bearer session-auth' },
  });
  return {
    response,
    body: await response.json(),
  };
}

test('GET /api/v2/workspace/files lists workspace-relative entries with content kinds', async () => {
  await withWorkspace(async ({ workspace }) => {
    await mkdir(join(workspace, 'docs'));
    await writeFile(join(workspace, 'docs', 'guide.md'), '# hello', 'utf8');
    await writeFile(join(workspace, 'config.json'), '{"ok":true}', 'utf8');
    await writeFile(join(workspace, 'photo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const app = createApp({ authToken: 'session-auth' });

    await withServer(app, async ({ port }) => {
      const search = new URLSearchParams({ workspace, path: '' });
      const response = await fetch(`http://127.0.0.1:${port}/api/v2/workspace/files?${search.toString()}`, {
        headers: { Authorization: 'Bearer session-auth' },
      });
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.deepEqual(body, {
        data: [
          {
            path: 'docs',
            name: 'docs',
            kind: 'directory',
            size: 0,
            ext: '',
            contentKind: null,
            isLarge: false,
          },
          {
            path: 'config.json',
            name: 'config.json',
            kind: 'file',
            size: 11,
            ext: '.json',
            contentKind: 'text',
            isLarge: false,
          },
          {
            path: 'photo.png',
            name: 'photo.png',
            kind: 'file',
            size: 4,
            ext: '.png',
            contentKind: 'image',
            isLarge: false,
          },
        ],
      });
    });
  });
});

test('GET /api/v2/workspace/files sorts directories before files and omits outside symlinks', async () => {
  await withWorkspace(async ({ workspace }) => {
    const outside = await mkdtemp(join(tmpdir(), 'my-code-x-outside-workspace-'));

    try {
      await mkdir(join(workspace, 'zeta'));
      await mkdir(join(workspace, 'alpha'));
      await writeFile(join(workspace, 'z-last.json'), '{"ok":true}', 'utf8');
      await writeFile(join(workspace, 'a-first.json'), '{"ok":true}', 'utf8');

      try {
        await symlink(outside, join(workspace, 'outside-link'), 'junction');
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error) {
          const code = String((error as { code?: string }).code || '');
          if (code === 'EPERM' || code === 'EACCES' || code === 'ENOTSUP') {
            return;
          }
        }

        throw error;
      }

      const app = createApp({ authToken: 'session-auth' });

      await withServer(app, async ({ port }) => {
        const search = new URLSearchParams({ workspace, path: '' });
        const response = await fetch(`http://127.0.0.1:${port}/api/v2/workspace/files?${search.toString()}`, {
          headers: { Authorization: 'Bearer session-auth' },
        });
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.deepEqual(body, {
          data: [
            { path: 'alpha', name: 'alpha', kind: 'directory', size: 0, ext: '', contentKind: null, isLarge: false },
            { path: 'zeta', name: 'zeta', kind: 'directory', size: 0, ext: '', contentKind: null, isLarge: false },
            {
              path: 'a-first.json',
              name: 'a-first.json',
              kind: 'file',
              size: 11,
              ext: '.json',
              contentKind: 'text',
              isLarge: false,
            },
            {
              path: 'z-last.json',
              name: 'z-last.json',
              kind: 'file',
              size: 11,
              ext: '.json',
              contentKind: 'text',
              isLarge: false,
            },
          ],
        });
      });
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });
});

test('GET /api/v2/workspace/file reads text files, including source files', async () => {
  await withWorkspace(async ({ workspace }) => {
    await mkdir(join(workspace, 'src'));
    await writeFile(join(workspace, 'src', 'app.tsx'), 'export function App() {}\n', 'utf8');

    const app = createApp({ authToken: 'session-auth' });

    await withServer(app, async ({ port }) => {
      const { response, body } = await fetchWorkspaceJson({
        port,
        workspace,
        path: 'src/app.tsx',
      });

      assert.equal(response.status, 200);
      assert.deepEqual(body, {
        kind: 'text',
        path: 'src/app.tsx',
        name: 'app.tsx',
        size: 25,
        encoding: 'utf-8',
        content: 'export function App() {}\n',
        truncated: false,
      });
    });
  });
});

test('GET /api/v2/workspace/file keeps large text files readable and supports full fetches', async () => {
  await withWorkspace(async ({ workspace }) => {
    const oversized = 'a'.repeat(140 * 1024);
    await writeFile(join(workspace, 'big.txt'), oversized, 'utf8');

    const app = createApp({ authToken: 'session-auth' });

    await withServer(app, async ({ port }) => {
      const previewSearch = new URLSearchParams({ workspace, path: 'big.txt' });
      const previewResponse = await fetch(`http://127.0.0.1:${port}/api/v2/workspace/file?${previewSearch.toString()}`, {
        headers: { Authorization: 'Bearer session-auth' },
      });
      const previewBody = await previewResponse.json();

      assert.equal(previewResponse.status, 200);
      assert.equal(previewBody.kind, 'text');
      assert.equal(previewBody.truncated, true);
      assert.ok(String(previewBody.content).length > 0);

      const fullSearch = new URLSearchParams({ workspace, path: 'big.txt', full: '1' });
      const fullResponse = await fetch(`http://127.0.0.1:${port}/api/v2/workspace/file?${fullSearch.toString()}`, {
        headers: { Authorization: 'Bearer session-auth' },
      });
      const fullBody = await fullResponse.json();

      assert.equal(fullResponse.status, 200);
      assert.equal(fullBody.kind, 'text');
      assert.equal(fullBody.truncated, false);
      assert.equal(fullBody.content.length, oversized.length);
    });
  });
});

test('GET /api/v2/workspace/file returns image detail and serves image bytes through content route', async () => {
  await withWorkspace(async ({ workspace }) => {
    const imageBody = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    await writeFile(join(workspace, 'photo.png'), imageBody);

    const app = createApp({ authToken: 'session-auth' });

    await withServer(app, async ({ port }) => {
      const { response, body } = await fetchWorkspaceJson({
        port,
        workspace,
        path: 'photo.png',
      });

      assert.equal(response.status, 200);
      const expectedContentSearch = new URLSearchParams({ workspace, path: 'photo.png' });
      assert.deepEqual(body, {
        kind: 'image',
        path: 'photo.png',
        name: 'photo.png',
        size: 4,
        contentType: 'image/png',
        url: `/api/v2/workspace/file/content?${expectedContentSearch.toString()}`,
      });

      const contentSearch = new URLSearchParams({ workspace, path: 'photo.png' });
      const contentResponse = await fetch(`http://127.0.0.1:${port}/api/v2/workspace/file/content?${contentSearch.toString()}`, {
        headers: { Authorization: 'Bearer session-auth' },
      });
      const contentBuffer = Buffer.from(await contentResponse.arrayBuffer());

      assert.equal(contentResponse.status, 200);
      assert.equal(contentResponse.headers.get('content-type'), 'image/png');
      assert.deepEqual(contentBuffer, imageBody);
    });
  });
});

test('GET /api/v2/workspace/file returns metadata for binary files', async () => {
  await withWorkspace(async ({ workspace }) => {
    await writeFile(join(workspace, 'archive.db'), Buffer.from([0x00, 0x01, 0x02]));

    const app = createApp({ authToken: 'session-auth' });

    await withServer(app, async ({ port }) => {
      const { response, body } = await fetchWorkspaceJson({
        port,
        workspace,
        path: 'archive.db',
      });

      assert.equal(response.status, 200);
      assert.deepEqual(body, {
        kind: 'binary',
        path: 'archive.db',
        name: 'archive.db',
        size: 3,
        contentType: null,
      });
    });
  });
});

test('workspace file APIs reject paths outside the workspace', async () => {
  await withWorkspace(async ({ workspace }) => {
    const app = createApp({ authToken: 'session-auth' });

    await withServer(app, async ({ port }) => {
      const search = new URLSearchParams({ workspace, path: '../secret.txt' });
      const response = await fetch(`http://127.0.0.1:${port}/api/v2/workspace/file?${search.toString()}`, {
        headers: { Authorization: 'Bearer session-auth' },
      });
      const body = await response.json();

      assert.equal(response.status, 403);
      assert.deepEqual(body, { error: { code: 'outside_workspace', message: 'outside_workspace', status: 403 } });
    });
  });
});

test('GET /api/v2/workspace/files rejects directory paths outside the workspace', async () => {
  await withWorkspace(async ({ workspace }) => {
    const app = createApp({ authToken: 'session-auth' });

    await withServer(app, async ({ port }) => {
      const search = new URLSearchParams({ workspace, path: '../secret-folder' });
      const response = await fetch(`http://127.0.0.1:${port}/api/v2/workspace/files?${search.toString()}`, {
        headers: { Authorization: 'Bearer session-auth' },
      });
      const body = await response.json();

      assert.equal(response.status, 403);
      assert.deepEqual(body, { error: { code: 'outside_workspace', message: 'outside_workspace', status: 403 } });
    });
  });
});

const testIfWindows = process.platform === 'win32' ? test : test.skip;

testIfWindows('workspace file APIs reject Windows drive-prefixed paths', async () => {
  await withWorkspace(async ({ workspace }) => {
    const app = createApp({ authToken: 'session-auth' });

    await withServer(app, async ({ port }) => {
      for (const path of ['C:secret.txt', 'C:/secret.txt']) {
        const search = new URLSearchParams({ workspace, path });
        const response = await fetch(`http://127.0.0.1:${port}/api/v2/workspace/file?${search.toString()}`, {
          headers: { Authorization: 'Bearer session-auth' },
        });
        const body = await response.json();

        assert.equal(response.status, 403);
        assert.deepEqual(body, { error: { code: 'outside_workspace', message: 'outside_workspace', status: 403 } });
      }
    });
  });
});

test('POST /api/v2/workspace/file saves text content', async () => {
  await withWorkspace(async ({ workspace }) => {
    await writeFile(join(workspace, 'config.json'), '{"ok":true}\n', 'utf8');

    const app = createApp({ authToken: 'session-auth' });

    await withServer(app, async ({ port }) => {
      const response = await fetch(`http://127.0.0.1:${port}/api/v2/workspace/file`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer session-auth',
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          workspace,
          path: 'config.json',
          content: '{"ok":false}\n',
        }),
      });
      const body = await response.json();
      const saved = await readFile(join(workspace, 'config.json'), 'utf8');

      assert.equal(response.status, 200);
      assert.equal(saved, '{"ok":false}\n');
      assert.equal(body.ok, true);
      assert.equal(body.path, 'config.json');
      assert.equal(body.size, 13);
      assert.equal(typeof body.updatedAt, 'string');
    });
  });
});

test('POST /api/v2/workspace/file rejects creating a new file', async () => {
  await withWorkspace(async ({ workspace }) => {
    const app = createApp({ authToken: 'session-auth' });

    await withServer(app, async ({ port }) => {
      const response = await fetch(`http://127.0.0.1:${port}/api/v2/workspace/file`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer session-auth',
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          workspace,
          path: 'new.txt',
          content: 'hello\n',
        }),
      });
      const body = await response.json();

      assert.equal(response.status, 404);
      assert.deepEqual(body, { error: { code: 'not_found', message: 'not_found', status: 404 } });
    });
  });
});

test('POST /api/v2/workspace/file rejects save targets outside the workspace', async () => {
  await withWorkspace(async ({ workspace }) => {
    await writeFile(join(workspace, 'notes.txt'), 'small\n', 'utf8');

    const app = createApp({ authToken: 'session-auth' });

    await withServer(app, async ({ port }) => {
      const response = await fetch(`http://127.0.0.1:${port}/api/v2/workspace/file`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer session-auth',
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          workspace,
          path: '../secret.txt',
          content: 'blocked\n',
        }),
      });
      const body = await response.json();

      assert.equal(response.status, 403);
      assert.deepEqual(body, { error: { code: 'outside_workspace', message: 'outside_workspace', status: 403 } });
    });
  });
});

test('POST /api/v2/workspace/file rejects binary save targets', async () => {
  await withWorkspace(async ({ workspace }) => {
    await writeFile(join(workspace, 'archive.db'), Buffer.from([0x00, 0x01, 0x02]));

    const app = createApp({ authToken: 'session-auth' });

    await withServer(app, async ({ port }) => {
      const response = await fetch(`http://127.0.0.1:${port}/api/v2/workspace/file`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer session-auth',
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          workspace,
          path: 'archive.db',
          content: 'blocked\n',
        }),
      });
      const body = await response.json();

      assert.equal(response.status, 415);
      assert.deepEqual(body, { error: { code: 'not_text_file', message: 'not_text_file', status: 415 } });
    });
  });
});

test('POST /api/v2/workspace/file returns 400 for invalid json', async () => {
  await withWorkspace(async ({ workspace }) => {
    await writeFile(join(workspace, 'notes.txt'), 'small\n', 'utf8');

    const app = createApp({ authToken: 'session-auth' });

    await withServer(app, async ({ port }) => {
      const response = await fetch(`http://127.0.0.1:${port}/api/v2/workspace/file`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer session-auth',
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: '{bad json',
      });
      const body = await response.json();

      assert.equal(response.status, 400);
      assert.deepEqual(body, { error: { code: 'invalid_json_body', message: 'invalid json body', status: 400 } });
    });
  });
});

test('GET /api/v2/workspace/file/content rejects non-image files', async () => {
  await withWorkspace(async ({ workspace }) => {
    await writeFile(join(workspace, 'notes.txt'), 'hello\n', 'utf8');

    const app = createApp({ authToken: 'session-auth' });

    await withServer(app, async ({ port }) => {
      const search = new URLSearchParams({ workspace, path: 'notes.txt' });
      const response = await fetch(`http://127.0.0.1:${port}/api/v2/workspace/file/content?${search.toString()}`, {
        headers: { Authorization: 'Bearer session-auth' },
      });
      const body = await response.json();

      assert.equal(response.status, 415);
      assert.deepEqual(body, { error: { code: 'not_image_file', message: 'not_image_file', status: 415 } });
    });
  });
});

test('GET /api/v2/workspace/file classifies .env and .gitignore as text', async () => {
  await withWorkspace(async ({ workspace }) => {
    await writeFile(join(workspace, '.env'), 'API_KEY=test\n', 'utf8');
    await writeFile(join(workspace, '.gitignore'), 'node_modules/\n', 'utf8');

    const app = createApp({ authToken: 'session-auth' });

    await withServer(app, async ({ port }) => {
      for (const path of ['.env', '.gitignore']) {
        const { response, body } = await fetchWorkspaceJson({ port, workspace, path });

        assert.equal(response.status, 200);
        assert.equal(body.kind, 'text');
        assert.equal(body.truncated, false);
      }
    });
  });
});
