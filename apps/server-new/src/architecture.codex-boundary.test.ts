import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

interface SourceFile {
  readonly relativePath: string;
  readonly source: string;
}

interface ForbiddenMatch {
  readonly relativePath: string;
  readonly value: string;
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = currentDir;

async function listSourceFiles(dir: string): Promise<readonly string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...await listSourceFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

async function readSourceFiles(relativeDirs: readonly string[]): Promise<readonly SourceFile[]> {
  const sourceFiles: SourceFile[] = [];

  for (const relativeDir of relativeDirs) {
    const absoluteDir = path.join(srcRoot, relativeDir);
    const absoluteFiles = await listSourceFiles(absoluteDir);

    for (const absoluteFile of absoluteFiles) {
      sourceFiles.push({
        relativePath: path.relative(srcRoot, absoluteFile),
        source: await readFile(absoluteFile, 'utf-8'),
      });
    }
  }

  return sourceFiles;
}

function findForbiddenMatches(sourceFiles: readonly SourceFile[], forbiddenPattern: RegExp): readonly ForbiddenMatch[] {
  const matches: ForbiddenMatch[] = [];

  for (const sourceFile of sourceFiles) {
    const sourceMatches = sourceFile.source.matchAll(forbiddenPattern);

    for (const sourceMatch of sourceMatches) {
      matches.push({
        relativePath: sourceFile.relativePath,
        value: sourceMatch[0],
      });
    }
  }

  return matches;
}

test('runtime port exposes internal runtime language without Codex transport vocabulary', async () => {
  const source = await readFile(path.join(srcRoot, 'ports', 'runtime-port.ts'), 'utf-8');
  const matches = findForbiddenMatches(
    [
      {
        relativePath: path.join('ports', 'runtime-port.ts'),
        source,
      },
    ],
    /\b(Codex|JSONL|jsonl|RPC|app-server|stdin|stdout)\b|method:\s*string|params:\s*unknown/g,
  );

  assert.deepEqual(matches, []);
});

test('features, application, and http do not depend on raw Codex protocol vocabulary', async () => {
  const sourceFiles = await readSourceFiles(['features', 'application', 'http']);
  const matches = findForbiddenMatches(
    sourceFiles,
    /\b(Codex|JSONL|jsonl|app-server|stdin|stdout|thread\/start|thread\/resume|turn\/start|turn\/interrupt|approval\/request)\b/g,
  );

  assert.deepEqual(matches, []);
});

test('codex adapter public entrypoint does not export transport, protocol, or non-contract runtime internals', async () => {
  const source = await readFile(path.join(srcRoot, 'adapters', 'codex', 'index.ts'), 'utf-8');
  const matches = findForbiddenMatches(
    [
      {
        relativePath: path.join('adapters', 'codex', 'index.ts'),
        source,
      },
    ],
    /from\s+['"](?:\.\/(?:transport|protocol)\/[^'"]+|\.\/runtime\/(?!codex-runtime-error\.js['"])[^'"]+)['"]/g,
  );

  assert.deepEqual(matches, []);
});

test('codex adapter implementation does not mention conversation/session ownership or HTTP boundary concepts', async () => {
  const sourceFiles = (await readSourceFiles([path.join('adapters', 'codex')])).filter(
    sourceFile => !sourceFile.relativePath.endsWith('.test.ts'),
  );
  const matches = findForbiddenMatches(
    sourceFiles,
    /\b(viewerId|slotId|ConversationSession|conversation session|HttpRequest|HttpResponse|controller)\b/g,
  );

  assert.deepEqual(matches, []);
});

test('frontend contracts do not expose adapter or transport vocabulary', async () => {
  const sourceFiles = await readSourceFiles(['contracts']);
  const matches = findForbiddenMatches(
    sourceFiles,
    /\b(Codex|method|params|jsonrpc|deltaField|raw|item\/agentMessage|thread\/realtime\/error)\b/g,
  );

  assert.deepEqual(matches, []);
});

test('client input boundary does not predeclare runtime command fields', async () => {
  const sourceFiles = await readSourceFiles(['http', 'application']);
  const matches = findForbiddenMatches(
    sourceFiles,
    /\b(RuntimeContentItem|RuntimeSettings|runtimeSettings|sandboxMode|reasoningEffort|approvalPolicy|promptOverride|baseInstructions|imagePath)\b/g,
  );

  assert.deepEqual(matches, []);
});

test('thread public state does not export runtime thread records', async () => {
  const sourceFiles = await readSourceFiles([path.join('features', 'thread')]);
  const publicSourceFiles = sourceFiles.filter(
    sourceFile => sourceFile.relativePath.endsWith('thread-events.ts') || sourceFile.relativePath.endsWith('index.ts'),
  );
  const matches = findForbiddenMatches(publicSourceFiles, /\bRuntimeThread\b/g);

  assert.deepEqual(matches, []);
});
