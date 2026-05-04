import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, test } from 'node:test';

import { createNodeAppDataStore } from './create-app-data-store.js';

const tempDirs: string[] = [];

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      await rm(dir, { force: true, recursive: true });
    }
  }
});

describe('node app data store', () => {
  test('reads null when document does not exist', async () => {
    const homeDirectory = await createTempDir();
    const store = createNodeAppDataStore({ homeDirectory });

    assert.equal(await store.readDocument({ name: 'workspaces.json' }), null);
  });

  test('creates app data directory writes and reads document', async () => {
    const homeDirectory = await createTempDir();
    const store = createNodeAppDataStore({ homeDirectory });

    await store.writeDocumentAtomically({
      name: 'workspaces.json',
      content: '{"version":1,"workspaces":[]}',
    });

    assert.equal(await store.readDocument({ name: 'workspaces.json' }), '{"version":1,"workspaces":[]}');
    assert.deepEqual(await readdir(path.join(homeDirectory, '.my-code-x')), ['workspaces.json']);
  });

  test('rejects document names that escape the app data directory', async () => {
    const homeDirectory = await createTempDir();
    const store = createNodeAppDataStore({ homeDirectory });

    await assert.rejects(store.writeDocumentAtomically({
      name: '../outside.json',
      content: '{}',
    }), {
      name: 'AppDataStoreError',
    });
    await assert.rejects(store.writeDocumentAtomically({
      name: '..\\outside.json',
      content: '{}',
    }), {
      name: 'AppDataStoreError',
    });
  });

  test('surfaces read failure as app data store error', async () => {
    const homeDirectoryFile = path.join(await createTempDir(), 'home-file');
    await writeFile(homeDirectoryFile, 'not a directory', 'utf-8');
    const store = createNodeAppDataStore({ homeDirectory: homeDirectoryFile });

    await assert.rejects(store.readDocument({ name: 'workspaces.json' }), {
      name: 'AppDataStoreError',
    });
  });

  test('surfaces write failure as app data store error', async () => {
    const homeDirectoryFile = path.join(await createTempDir(), 'home-file');
    await writeFile(homeDirectoryFile, 'not a directory', 'utf-8');
    const store = createNodeAppDataStore({ homeDirectory: homeDirectoryFile });

    await assert.rejects(store.writeDocumentAtomically({ name: 'workspaces.json', content: '{}' }), {
      name: 'AppDataStoreError',
    });
  });
});

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'my-code-x-app-data-'));
  tempDirs.push(dir);
  return dir;
}

