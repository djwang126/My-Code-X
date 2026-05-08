import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

async function withTempWorkspace(run) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'my-code-x-prompt-override-'));

  try {
    await run(tempRoot);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

async function loadPromptOverrideLoader() {
  return import('./prompt-override-loader.js');
}

async function loadPromptOverrideResolverModule() {
  return import('./prompt-override-resolver.js');
}

test('loadPromptOverrideSnapshot reads markdown overrides from custom-harness/prompts-override', async () => {
  await withTempWorkspace(async tempRoot => {
    const { loadPromptOverrideSnapshot } = await loadPromptOverrideLoader();
    const promptsOverrideDir = path.join(tempRoot, 'custom-harness', 'prompts-override');
    await fs.mkdir(promptsOverrideDir, { recursive: true });
    await fs.writeFile(path.join(promptsOverrideDir, 'normal.md'), 'You are a supportive teammate\n', 'utf8');
    await fs.writeFile(path.join(promptsOverrideDir, 'cat.md'), 'You are a cute cat\n', 'utf8');
    await fs.writeFile(path.join(promptsOverrideDir, 'README.txt'), 'ignore me\n', 'utf8');
    await fs.writeFile(path.join(promptsOverrideDir, '.hidden.md'), 'ignore me too\n', 'utf8');

    const snapshot = await loadPromptOverrideSnapshot({ workspaceRoot: tempRoot });

    assert.deepEqual(snapshot.options, [
      { value: 'cat', label: 'cat', description: '' },
      { value: 'normal', label: 'normal', description: '' },
    ]);
  });
});

test('loadPromptOverrideSnapshot ignores the ambiguous custom-harness/prompts folder', async () => {
  await withTempWorkspace(async tempRoot => {
    const { loadPromptOverrideSnapshot } = await loadPromptOverrideLoader();
    const ambiguousDir = path.join(tempRoot, 'custom-harness', 'prompts');
    await fs.mkdir(ambiguousDir, { recursive: true });
    await fs.writeFile(path.join(ambiguousDir, 'normal.md'), 'wrong folder\n', 'utf8');

    const snapshot = await loadPromptOverrideSnapshot({ workspaceRoot: tempRoot });

    assert.deepEqual(snapshot.options, []);
  });
});

test('loadPromptOverrideSnapshot ignores nested directories and only uses top-level markdown files', async () => {
  await withTempWorkspace(async tempRoot => {
    const { loadPromptOverrideSnapshot } = await loadPromptOverrideLoader();
    const promptsOverrideDir = path.join(tempRoot, 'custom-harness', 'prompts-override');
    await fs.mkdir(path.join(promptsOverrideDir, 'nested'), { recursive: true });
    await fs.writeFile(path.join(promptsOverrideDir, 'normal.md'), 'You are a supportive teammate\n', 'utf8');
    await fs.writeFile(path.join(promptsOverrideDir, 'nested', 'cat.md'), 'You are a cute cat\n', 'utf8');

    const snapshot = await loadPromptOverrideSnapshot({ workspaceRoot: tempRoot });

    assert.deepEqual(snapshot.options, [{ value: 'normal', label: 'normal', description: '' }]);
  });
});

test('loadPromptOverrideSnapshot exposes blank markdown files as valid overrides', async () => {
  await withTempWorkspace(async tempRoot => {
    const { loadPromptOverrideSnapshot } = await loadPromptOverrideLoader();
    const promptsOverrideDir = path.join(tempRoot, 'custom-harness', 'prompts-override');
    await fs.mkdir(promptsOverrideDir, { recursive: true });
    await fs.writeFile(path.join(promptsOverrideDir, 'normal.md'), 'You are a supportive teammate\n', 'utf8');
    await fs.writeFile(path.join(promptsOverrideDir, 'blank.md'), '   \n\t', 'utf8');

    const snapshot = await loadPromptOverrideSnapshot({ workspaceRoot: tempRoot });

    assert.deepEqual(snapshot.options, [
      { value: 'blank', label: 'blank', description: '' },
      { value: 'normal', label: 'normal', description: '' },
    ]);
    assert.equal(snapshot.instructionsByPromptOverride.get('blank'), '   \n\t');
  });
});

test('loadPromptOverrideSnapshot returns an empty list when custom-harness/prompts-override is missing', async () => {
  await withTempWorkspace(async tempRoot => {
    const { loadPromptOverrideSnapshot } = await loadPromptOverrideLoader();
    const snapshot = await loadPromptOverrideSnapshot({ workspaceRoot: tempRoot });

    assert.deepEqual(snapshot.options, []);
  });
});

test('createPromptOverrideResolver reads the selected override from the startup snapshot', async () => {
  await withTempWorkspace(async tempRoot => {
    const { loadPromptOverrideSnapshot } = await loadPromptOverrideLoader();
    const { createPromptOverrideResolver } = await loadPromptOverrideResolverModule();
    const promptsOverrideDir = path.join(tempRoot, 'custom-harness', 'prompts-override');
    await fs.mkdir(promptsOverrideDir, { recursive: true });
    await fs.writeFile(path.join(promptsOverrideDir, 'normal.md'), 'You are a supportive teammate\n', 'utf8');
    const promptOverrideSnapshot = await loadPromptOverrideSnapshot({ workspaceRoot: tempRoot });
    const resolver = createPromptOverrideResolver({ workspaceRoot: tempRoot, promptOverrideSnapshot });

    const instructions = await resolver.resolvePromptOverride('normal');

    assert.equal(instructions, 'You are a supportive teammate\n');
  });
});

test('createPromptOverrideResolver fails clearly when the override does not exist in the startup snapshot', async () => {
  await withTempWorkspace(async tempRoot => {
    const { loadPromptOverrideSnapshot } = await loadPromptOverrideLoader();
    const { createPromptOverrideResolver } = await loadPromptOverrideResolverModule();
    const promptsOverrideDir = path.join(tempRoot, 'custom-harness', 'prompts-override');
    await fs.mkdir(promptsOverrideDir, { recursive: true });
    await fs.writeFile(path.join(promptsOverrideDir, 'normal.md'), 'You are a supportive teammate\n', 'utf8');
    const promptOverrideSnapshot = await loadPromptOverrideSnapshot({ workspaceRoot: tempRoot });
    const resolver = createPromptOverrideResolver({ workspaceRoot: tempRoot, promptOverrideSnapshot });

    await assert.rejects(
      resolver.resolvePromptOverride('missing-prompt'),
      error => error instanceof Error && error.message === 'prompt override not found: missing-prompt',
    );
  });
});

test('createPromptOverrideResolver rejects invalid prompt override values', async () => {
  await withTempWorkspace(async tempRoot => {
    const { loadPromptOverrideSnapshot } = await loadPromptOverrideLoader();
    const { createPromptOverrideResolver } = await loadPromptOverrideResolverModule();
    const promptsOverrideDir = path.join(tempRoot, 'custom-harness', 'prompts-override');
    await fs.mkdir(promptsOverrideDir, { recursive: true });
    await fs.writeFile(path.join(promptsOverrideDir, 'normal.md'), 'You are a supportive teammate\n', 'utf8');
    const promptOverrideSnapshot = await loadPromptOverrideSnapshot({ workspaceRoot: tempRoot });
    const resolver = createPromptOverrideResolver({ workspaceRoot: tempRoot, promptOverrideSnapshot });

    await assert.rejects(
      resolver.resolvePromptOverride('..\\normal'),
      error => error instanceof Error && error.message === 'prompt override not found: ..\\normal',
    );
  });
});

test('createPromptOverrideResolver returns blank content for an empty prompt file in the startup snapshot', async () => {
  await withTempWorkspace(async tempRoot => {
    const { loadPromptOverrideSnapshot } = await loadPromptOverrideLoader();
    const { createPromptOverrideResolver } = await loadPromptOverrideResolverModule();
    const promptsOverrideDir = path.join(tempRoot, 'custom-harness', 'prompts-override');
    await fs.mkdir(promptsOverrideDir, { recursive: true });
    await fs.writeFile(path.join(promptsOverrideDir, 'blank.md'), '   \n\t', 'utf8');
    const promptOverrideSnapshot = await loadPromptOverrideSnapshot({ workspaceRoot: tempRoot });
    const resolver = createPromptOverrideResolver({ workspaceRoot: tempRoot, promptOverrideSnapshot });

    const instructions = await resolver.resolvePromptOverride('blank');

    assert.equal(instructions, '   \n\t');
  });
});

test('createPromptOverrideResolver resolves from the startup snapshot even after files change on disk', async () => {
  await withTempWorkspace(async tempRoot => {
    const { loadPromptOverrideSnapshot } = await loadPromptOverrideLoader();
    const { createPromptOverrideResolver } = await loadPromptOverrideResolverModule();
    const promptsOverrideDir = path.join(tempRoot, 'custom-harness', 'prompts-override');
    await fs.mkdir(promptsOverrideDir, { recursive: true });
    await fs.writeFile(path.join(promptsOverrideDir, 'normal.md'), 'initial instructions\n', 'utf8');

    const promptOverrideSnapshot = await loadPromptOverrideSnapshot({ workspaceRoot: tempRoot });
    const resolver = createPromptOverrideResolver({
      workspaceRoot: tempRoot,
      promptOverrideSnapshot,
    });

    await fs.writeFile(path.join(promptsOverrideDir, 'normal.md'), 'updated instructions\n', 'utf8');
    await fs.writeFile(path.join(promptsOverrideDir, 'cat.md'), 'new prompt after startup\n', 'utf8');

    assert.deepEqual(await resolver.discoverPromptOverrideOptions(), [
      { value: 'normal', label: 'normal', description: '' },
    ]);
    assert.equal(await resolver.resolvePromptOverride('normal'), 'initial instructions\n');
    await assert.rejects(
      resolver.resolvePromptOverride('cat'),
      error => error instanceof Error && error.message === 'prompt override not found: cat',
    );
  });
});

test('loadPromptOverrideSnapshot ignores prompt-like directories because only top-level regular markdown files are valid', async () => {
  await withTempWorkspace(async tempRoot => {
    const { loadPromptOverrideSnapshot } = await loadPromptOverrideLoader();
    const promptsOverrideDir = path.join(tempRoot, 'custom-harness', 'prompts-override');
    await fs.mkdir(path.join(promptsOverrideDir, 'folder.md'), { recursive: true });

    const snapshot = await loadPromptOverrideSnapshot({ workspaceRoot: tempRoot });
    assert.deepEqual(snapshot.options, []);
  });
});

test('loadPromptOverrideSnapshot supports reading directly from a user-scoped custom-harness root', async () => {
  await withTempWorkspace(async tempRoot => {
    const { loadPromptOverrideSnapshot } = await loadPromptOverrideLoader();
    const customHarnessRoot = path.join(tempRoot, '.My-Code-X', 'custom-harness');
    const promptsOverrideDir = path.join(customHarnessRoot, 'prompts-override');
    await fs.mkdir(promptsOverrideDir, { recursive: true });
    await fs.writeFile(path.join(promptsOverrideDir, 'normal.md'), 'user scoped prompt\n', 'utf8');

    const snapshot = await loadPromptOverrideSnapshot({ customHarnessRoot });

    assert.deepEqual(snapshot.options, [{ value: 'normal', label: 'normal', description: '' }]);
    assert.equal(snapshot.instructionsByPromptOverride.get('normal'), 'user scoped prompt\n');
  });
});

test('resolveCustomHarnessRoot preserves Windows absolute custom-harness paths on any platform', async () => {
  const { resolveCustomHarnessRoot } = await loadPromptOverrideLoader();

  assert.equal(
    resolveCustomHarnessRoot({
      workspaceRoot: '/home/example/workspace',
      customHarnessRoot: 'D:/users/example/.My-Code-X/custom-harness',
    }),
    'D:/users/example/.My-Code-X/custom-harness',
  );
});
