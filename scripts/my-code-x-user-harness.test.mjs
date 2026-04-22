import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { mkdtempSync } from 'node:fs';
import {
  ensureMyCodeXCustomHarness,
  resolveMyCodeXCustomHarnessDir,
} from '@my-code-x/utils/my-code-x-user-harness';

test('resolveMyCodeXCustomHarnessDir defaults to ~/.My-Code-X/custom-harness', () => {
  const homeDir = path.join(os.tmpdir(), 'my-code-x-harness-home');
  assert.equal(
    resolveMyCodeXCustomHarnessDir({ userDir: '', homeDir }),
    path.join(homeDir, '.My-Code-X', 'custom-harness'),
  );
});

test('ensureMyCodeXCustomHarness copies installRoot/custom-harness into the user dir once', async () => {
  const installRoot = mkdtempSync(path.join(os.tmpdir(), 'my-code-x-install-'));
  const homeDir = mkdtempSync(path.join(os.tmpdir(), 'my-code-x-home-'));

  try {
    const sourceDir = path.join(installRoot, 'custom-harness', 'prompts-override');
    await fs.mkdir(sourceDir, { recursive: true });
    await fs.writeFile(path.join(sourceDir, 'normal.md'), 'default prompt\n', 'utf8');

    const created = await ensureMyCodeXCustomHarness({ installRoot, homeDir });
    const copiedFile = path.join(homeDir, '.My-Code-X', 'custom-harness', 'prompts-override', 'normal.md');

    assert.equal(created.created, true);
    assert.equal(created.targetDir, path.join(homeDir, '.My-Code-X', 'custom-harness'));
    assert.equal(await fs.readFile(copiedFile, 'utf8'), 'default prompt\n');

    await fs.writeFile(copiedFile, 'user override\n', 'utf8');
    const secondRun = await ensureMyCodeXCustomHarness({ installRoot, homeDir });

    assert.equal(secondRun.created, false);
    assert.equal(await fs.readFile(copiedFile, 'utf8'), 'user override\n');
  } finally {
    await fs.rm(installRoot, { recursive: true, force: true });
    await fs.rm(homeDir, { recursive: true, force: true });
  }
});
