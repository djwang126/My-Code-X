import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createApp } from '../../app/app.js';
import { withServer } from '../../common/testing/http-test-helpers.js';

async function withWorkspace(run) {
  const workspace = await mkdtemp(join(tmpdir(), 'my-code-x-workspace-'));

  try {
    await run({ workspace });
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

test('GET /api/v2/workspace/files lists workspace-relative directory entries', async () => {
  await withWorkspace(async ({ workspace }) => {
    await mkdir(join(workspace, 'docs'));
    await writeFile(join(workspace, 'docs', 'guide.md'), '# hello', 'utf8');
    await writeFile(join(workspace, 'config.json'), '{"ok":true}', 'utf8');

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
            isTextEditable: false,
          },
          {
            path: 'config.json',
            name: 'config.json',
            kind: 'file',
            size: 11,
            ext: '.json',
            isTextEditable: true,
          },
        ],
      });
    });
  });
});

test('GET /api/v2/workspace/files sorts directories before files and keeps names alphabetical within each kind', async () => {
  await withWorkspace(async ({ workspace }) => {
    await mkdir(join(workspace, 'zeta'));
    await mkdir(join(workspace, 'alpha'));
    await writeFile(join(workspace, 'z-last.json'), '{"ok":true}', 'utf8');
    await writeFile(join(workspace, 'a-first.json'), '{"ok":true}', 'utf8');

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
            path: 'alpha',
            name: 'alpha',
            kind: 'directory',
            size: 0,
            ext: '',
            isTextEditable: false,
          },
          {
            path: 'zeta',
            name: 'zeta',
            kind: 'directory',
            size: 0,
            ext: '',
            isTextEditable: false,
          },
          {
            path: 'a-first.json',
            name: 'a-first.json',
            kind: 'file',
            size: 11,
            ext: '.json',
            isTextEditable: true,
          },
          {
            path: 'z-last.json',
            name: 'z-last.json',
            kind: 'file',
            size: 11,
            ext: '.json',
            isTextEditable: true,
          },
        ],
      });
    });
  });
});

test('GET /api/v2/workspace/files omits symlinked entries that resolve outside the workspace', async () => {
  await withWorkspace(async ({ workspace }) => {
    const outside = await mkdtemp(join(tmpdir(), 'my-code-x-outside-workspace-'));

    try {
      await writeFile(join(workspace, 'config.json'), '{"ok":true}', 'utf8');

      try {
        await symlink(outside, join(workspace, 'outside-link'), 'junction');
      } catch (error) {
        if (error?.code === 'EPERM' || error?.code === 'EACCES' || error?.code === 'ENOTSUP') {
          return;
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
            {
              path: 'config.json',
              name: 'config.json',
              kind: 'file',
              size: 11,
              ext: '.json',
              isTextEditable: true,
            },
          ],
        });
      });
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });
});

test('GET /api/v2/workspace/files skips broken symlinked entries instead of failing the whole listing', async () => {
  await withWorkspace(async ({ workspace }) => {
    await writeFile(join(workspace, 'config.json'), '{"ok":true}', 'utf8');

    try {
      await symlink(
        join(workspace, 'missing-target'),
        join(workspace, 'broken-link'),
        process.platform === 'win32' ? 'junction' : undefined,
      );
    } catch (error) {
      if (error?.code === 'EPERM' || error?.code === 'EACCES' || error?.code === 'ENOTSUP') {
        return;
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
          {
            path: 'config.json',
            name: 'config.json',
            kind: 'file',
            size: 11,
            ext: '.json',
            isTextEditable: true,
          },
        ],
      });
    });
  });
});

test('GET /api/v2/workspace/file reads a small editable text file', async () => {
  await withWorkspace(async ({ workspace }) => {
    await mkdir(join(workspace, 'docs'));
    await writeFile(join(workspace, 'docs', 'guide.md'), '# hello\nworld\n', 'utf8');

    const app = createApp({ authToken: 'session-auth' });

    await withServer(app, async ({ port }) => {
      const search = new URLSearchParams({ workspace, path: 'docs/guide.md' });
      const response = await fetch(`http://127.0.0.1:${port}/api/v2/workspace/file?${search.toString()}`, {
        headers: { Authorization: 'Bearer session-auth' },
      });
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.deepEqual(body, {
        path: 'docs/guide.md',
        name: 'guide.md',
        size: 14,
        encoding: 'utf-8',
        content: '# hello\nworld\n',
        isTextEditable: true,
        tooLarge: false,
      });
    });
  });
});

test('GET /api/v2/workspace/file returns tooLarge for files over 256 KB', async () => {
  await withWorkspace(async ({ workspace }) => {
    const oversized = 'a'.repeat(256 * 1024 + 1);
    await writeFile(join(workspace, 'big.txt'), oversized, 'utf8');

    const app = createApp({ authToken: 'session-auth' });

    await withServer(app, async ({ port }) => {
      const search = new URLSearchParams({ workspace, path: 'big.txt' });
      const response = await fetch(`http://127.0.0.1:${port}/api/v2/workspace/file?${search.toString()}`, {
        headers: { Authorization: 'Bearer session-auth' },
      });
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.deepEqual(body, {
        path: 'big.txt',
        name: 'big.txt',
        size: 256 * 1024 + 1,
        encoding: 'utf-8',
        content: '',
        isTextEditable: true,
        tooLarge: true,
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

test('POST /api/v2/workspace/file saves editable text content', async () => {
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

test('POST /api/v2/workspace/file rejects creating a new file in v1', async () => {
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

test('POST /api/v2/workspace/file rejects oversized content', async () => {
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
          path: 'notes.txt',
          content: 'a'.repeat(256 * 1024 + 1),
        }),
      });
      const body = await response.json();

      assert.equal(response.status, 413);
      assert.deepEqual(body, { error: { code: 'too_large', message: 'too_large', status: 413 } });
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

test('GET /api/v2/workspace/file rejects non-editable files', async () => {
  await withWorkspace(async ({ workspace }) => {
    await writeFile(join(workspace, 'image.svg'), '<svg></svg>\n', 'utf8');

    const app = createApp({ authToken: 'session-auth' });

    await withServer(app, async ({ port }) => {
      const search = new URLSearchParams({ workspace, path: 'image.svg' });
      const response = await fetch(`http://127.0.0.1:${port}/api/v2/workspace/file?${search.toString()}`, {
        headers: { Authorization: 'Bearer session-auth' },
      });
      const body = await response.json();

      assert.equal(response.status, 415);
      assert.deepEqual(body, { error: { code: 'not_text_editable', message: 'not_text_editable', status: 415 } });
    });
  });
});

test('GET /api/v2/workspace/file treats .env files as editable config files', async () => {
  await withWorkspace(async ({ workspace }) => {
    await writeFile(join(workspace, '.env'), 'API_KEY=test\n', 'utf8');

    const app = createApp({ authToken: 'session-auth' });

    await withServer(app, async ({ port }) => {
      const listSearch = new URLSearchParams({ workspace, path: '' });
      const listResponse = await fetch(`http://127.0.0.1:${port}/api/v2/workspace/files?${listSearch.toString()}`, {
        headers: { Authorization: 'Bearer session-auth' },
      });
      const listBody = await listResponse.json();

      assert.equal(listResponse.status, 200);
      assert.deepEqual(listBody, {
        data: [
          {
            path: '.env',
            name: '.env',
            kind: 'file',
            size: 13,
            ext: '',
            isTextEditable: true,
          },
        ],
      });

      const readSearch = new URLSearchParams({ workspace, path: '.env' });
      const readResponse = await fetch(`http://127.0.0.1:${port}/api/v2/workspace/file?${readSearch.toString()}`, {
        headers: { Authorization: 'Bearer session-auth' },
      });
      const readBody = await readResponse.json();

      assert.equal(readResponse.status, 200);
      assert.deepEqual(readBody, {
        path: '.env',
        name: '.env',
        size: 13,
        encoding: 'utf-8',
        content: 'API_KEY=test\n',
        isTextEditable: true,
        tooLarge: false,
      });
    });
  });
});

test('GET /api/v2/workspace/file treats .env.* files as editable config files', async () => {
  await withWorkspace(async ({ workspace }) => {
    await writeFile(join(workspace, '.env.local'), 'API_KEY=local\n', 'utf8');

    const app = createApp({ authToken: 'session-auth' });

    await withServer(app, async ({ port }) => {
      const search = new URLSearchParams({ workspace, path: '.env.local' });
      const response = await fetch(`http://127.0.0.1:${port}/api/v2/workspace/file?${search.toString()}`, {
        headers: { Authorization: 'Bearer session-auth' },
      });
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.deepEqual(body, {
        path: '.env.local',
        name: '.env.local',
        size: 14,
        encoding: 'utf-8',
        content: 'API_KEY=local\n',
        isTextEditable: true,
        tooLarge: false,
      });
    });
  });
});

test('GET /api/v2/workspace/file treats .gitignore as an editable config file', async () => {
  await withWorkspace(async ({ workspace }) => {
    await writeFile(join(workspace, '.gitignore'), 'node_modules/\n', 'utf8');

    const app = createApp({ authToken: 'session-auth' });

    await withServer(app, async ({ port }) => {
      const search = new URLSearchParams({ workspace, path: '.gitignore' });
      const response = await fetch(`http://127.0.0.1:${port}/api/v2/workspace/file?${search.toString()}`, {
        headers: { Authorization: 'Bearer session-auth' },
      });
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.deepEqual(body, {
        path: '.gitignore',
        name: '.gitignore',
        size: 14,
        encoding: 'utf-8',
        content: 'node_modules/\n',
        isTextEditable: true,
        tooLarge: false,
      });
    });
  });
});
