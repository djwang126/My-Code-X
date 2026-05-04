import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, test } from 'node:test';

import { createNodePathInspection, type NodePathInspectionDependencies } from './create-path-inspection.js';

const tempDirs: string[] = [];

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      await rm(dir, { force: true, recursive: true });
    }
  }
});

describe('node path inspection', () => {
  test('returns canonical path for accessible directory', async () => {
    const dir = await createTempDir();
    const inspector = createNodePathInspection();
    const expectedRealPath = await import('node:fs/promises').then(fs => fs.realpath(dir));

    const result = await inspector.inspect({ path: dir });

    assert.deepEqual(result, {
      status: 'available',
      canonicalPath: expectedRealPath,
      basename: path.basename(expectedRealPath),
    });
  });

  test('rejects relative path', async () => {
    const inspector = createNodePathInspection();

    assert.deepEqual(await inspector.inspect({ path: 'relative/path' }), {
      status: 'invalid',
      reason: 'relative',
      message: '路径必须是绝对路径',
    });
  });

  test('rejects missing path', async () => {
    const dir = await createTempDir();
    const missing = path.join(dir, 'missing');
    const inspector = createNodePathInspection();

    assert.deepEqual(await inspector.inspect({ path: missing }), {
      status: 'invalid',
      reason: 'missing',
      message: '路径不存在',
    });
  });

  test('returns inaccessible when stat fails with permission error', async () => {
    const dir = await createTempDir();
    const privateDir = path.join(dir, 'private');
    const inspector = createNodePathInspection({
      async stat() {
        throw createNodeError('EACCES');
      },
      async access() {},
      async realpath() {
        return 'D:\\workspaces\\private';
      },
    });

    assert.deepEqual(await inspector.inspect({ path: privateDir }), {
      status: 'invalid',
      reason: 'inaccessible',
      message: '路径不可访问',
    });
  });

  test('returns inaccessible when stat fails with operation not permitted', async () => {
    const dir = await createTempDir();
    const privateDir = path.join(dir, 'private');
    const inspector = createNodePathInspection({
      async stat() {
        throw createNodeError('EPERM');
      },
      async access() {},
      async realpath() {
        return privateDir;
      },
    });

    assert.deepEqual(await inspector.inspect({ path: privateDir }), {
      status: 'invalid',
      reason: 'inaccessible',
      message: '路径不可访问',
    });
  });

  test('returns missing when stat fails with not found', async () => {
    const dir = await createTempDir();
    const missing = path.join(dir, 'missing');
    const inspector = createNodePathInspection({
      async stat() {
        throw createNodeError('ENOENT');
      },
      async access() {},
      async realpath() {
        return missing;
      },
    });

    assert.deepEqual(await inspector.inspect({ path: missing }), {
      status: 'invalid',
      reason: 'missing',
      message: '路径不存在',
    });
  });

  test('does not trim input path before inspection', async () => {
    const seenPaths: string[] = [];
    const dirWithTrailingSpaces = `${await createTempDir()}  `;
    const inspector = createNodePathInspection({
      async stat(path) {
        seenPaths.push(path);
        return {
          isDirectory() {
            return true;
          },
        };
      },
      async access(path) {
        seenPaths.push(path);
      },
      async realpath(path) {
        seenPaths.push(path);
        return path;
      },
    });

    await inspector.inspect({ path: dirWithTrailingSpaces });

    assert.deepEqual(seenPaths, [
      dirWithTrailingSpaces,
      dirWithTrailingSpaces,
      dirWithTrailingSpaces,
    ]);
  });

  test('rejects file path', async () => {
    const dir = await createTempDir();
    const file = path.join(dir, 'file.txt');
    await writeFile(file, 'content', 'utf-8');
    const inspector = createNodePathInspection();

    assert.deepEqual(await inspector.inspect({ path: file }), {
      status: 'invalid',
      reason: 'not-directory',
      message: '路径不是目录',
    });
  });

  test('rejects inaccessible directory when access fails', async () => {
    const dir = await createTempDir();
    const inspector = createNodePathInspection(createInspectionDependencies({
      isDirectory: true,
      accessFailure: true,
      realpathResult: dir,
    }));

    assert.deepEqual(await inspector.inspect({ path: dir }), {
      status: 'invalid',
      reason: 'inaccessible',
      message: '路径不可访问',
    });
  });

  test('rejects directory when canonicalization fails', async () => {
    const dir = await createTempDir();
    const inspector = createNodePathInspection(createInspectionDependencies({
      isDirectory: true,
      accessFailure: false,
      realpathFailure: true,
    }));

    assert.deepEqual(await inspector.inspect({ path: dir }), {
      status: 'invalid',
      reason: 'canonicalization-failed',
      message: '路径不可解析',
    });
  });
});

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'my-code-x-path-'));
  tempDirs.push(dir);
  return dir;
}

interface CreateInspectionDependenciesInput {
  readonly isDirectory: boolean;
  readonly accessFailure: boolean;
  readonly realpathResult?: string;
  readonly realpathFailure?: boolean;
}

function createInspectionDependencies(input: CreateInspectionDependenciesInput): NodePathInspectionDependencies {
  return {
    async stat() {
      return {
        isDirectory() {
          return input.isDirectory;
        },
      };
    },

    async access() {
      if (input.accessFailure) {
        throw new Error('access failed');
      }
    },

    async realpath() {
      if (input.realpathFailure) {
        throw new Error('realpath failed');
      }

      return input.realpathResult ?? 'D:\\workspaces\\demo';
    },
  };
}

function createNodeError(code: string): Error & { readonly code: string } {
  const error = new Error(code) as Error & { code: string };
  error.code = code;
  return error;
}
