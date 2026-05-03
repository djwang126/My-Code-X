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
const contractsSrcRoot = path.resolve(srcRoot, '..', '..', 'contracts', 'src');

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
  return readSourceFilesFromRoot({ root: srcRoot, relativeDirs });
}

interface ReadSourceFilesFromRootInput {
  readonly root: string;
  readonly relativeDirs: readonly string[];
}

async function readSourceFilesFromRoot(input: ReadSourceFilesFromRootInput): Promise<readonly SourceFile[]> {
  const sourceFiles: SourceFile[] = [];

  for (const relativeDir of input.relativeDirs) {
    const absoluteDir = path.join(input.root, relativeDir);
    const absoluteFiles = await listSourceFiles(absoluteDir);

    for (const absoluteFile of absoluteFiles) {
      sourceFiles.push({
        relativePath: path.relative(input.root, absoluteFile),
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

test('runtime port exposes internal runtime language without external transport vocabulary', async () => {
  const sourceFiles = await readSourceFiles(['ports']);
  const matches = findForbiddenMatches(
    sourceFiles,
    /\b(Codex|JSONL|jsonl|RPC|app-server|stdin|stdout|RuntimeCodex|runtime-codex)\b|method\??:\s*string|params:\s*unknown/g,
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
    /from\s+['"](?:\.\/(?:transport|protocol|codec|gateway|diagnostics)\/[^'"]+|\.\/runtime\/(?!codex-runtime-error\.js['"])[^'"]+)['"]/g,
  );

  assert.deepEqual(matches, []);
});

test('codex adapter internals keep transport, protocol, and codec dependency direction', async () => {
  const sourceFiles = (await readSourceFiles([path.join('adapters', 'codex')])).filter(
    sourceFile => !sourceFile.relativePath.endsWith('.test.ts'),
  );
  const violations: string[] = [];

  for (const sourceFile of sourceFiles) {
    const normalizedPath = sourceFile.relativePath.split(path.sep).join('/');
    const source = sourceFile.source;

    if (normalizedPath.includes('/protocol/') && /from\s+['"][^'"]*\/transport\//.test(source)) {
      violations.push(`${sourceFile.relativePath} imports transport`);
    }

    if (normalizedPath.includes('/protocol/') && /from\s+['"][^'"]*\/ports\//.test(source)) {
      violations.push(`${sourceFile.relativePath} imports ports`);
    }

    if (normalizedPath.includes('/codec/') && /from\s+['"][^'"]*\/transport\//.test(source)) {
      violations.push(`${sourceFile.relativePath} imports transport`);
    }

    if (normalizedPath.includes('/transport/') && /from\s+['"][^'"]*\/ports\//.test(source)) {
      violations.push(`${sourceFile.relativePath} imports ports`);
    }
  }

  assert.deepEqual(violations, []);
});

test('codex adapter implementation does not mention conversation/slot ownership or HTTP boundary concepts', async () => {
  const sourceFiles = (await readSourceFiles([path.join('adapters', 'codex')])).filter(
    sourceFile => !sourceFile.relativePath.endsWith('.test.ts'),
  );
  const matches = findForbiddenMatches(
    sourceFiles,
    /\b(slotId|HttpRequest|HttpResponse|controller)\b/g,
  );

  assert.deepEqual(matches, []);
});

test('frontend contracts do not expose adapter or transport vocabulary', async () => {
  const sourceFiles = await readSourceFilesFromRoot({
    root: contractsSrcRoot,
    relativeDirs: ['.'],
  });
  const matches = findForbiddenMatches(
    sourceFiles.filter(sourceFile => !sourceFile.relativePath.endsWith('.test.ts')),
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

test('runtime event coordinator is not wired to the pending request skeleton', async () => {
  const source = await readFile(path.join(srcRoot, 'application', 'runtime-event-coordinator.ts'), 'utf-8');
  const matches = findForbiddenMatches(
    [
      {
        relativePath: path.join('application', 'runtime-event-coordinator.ts'),
        source,
      },
    ],
    /features\/runtime-request|RuntimeRequestService|runtimeRequests/g,
  );

  assert.deepEqual(matches, []);
});

test('server-new does not expose the old runtime request skeleton', async () => {
  const sourceFiles = await readSourceFiles(['features', 'application', 'presenter', 'ports']);
  const matches = findForbiddenMatches(
    sourceFiles,
    /\b(RuntimeRequestKind|RuntimeRequestService|createRuntimeRequestService|responseKind|tool-response)\b/g,
  );

  assert.deepEqual(matches, []);
});

test('presenter does not expose pending interaction skeleton presenters', async () => {
  const source = await readFile(path.join(srcRoot, 'presenter', 'index.ts'), 'utf-8');
  const matches = findForbiddenMatches(
    [
      {
        relativePath: path.join('presenter', 'index.ts'),
        source,
      },
    ],
    /pending-interaction-presenter|presentPendingInteraction|presentPendingInteractions/g,
  );

  assert.deepEqual(matches, []);
});

test('runtime port does not expose placeholder host request presentation policy', async () => {
  const sourceFiles = await readSourceFiles([path.join('ports', 'runtime')]);
  const matches = findForbiddenMatches(
    sourceFiles,
    /\b(inputKind|responseKind|RuntimeRequestKind|tool-response)\b|kind:\s*['"](?:approval|form|auth)['"]/g,
  );

  assert.deepEqual(matches, []);
});

test('Codex server request placeholder handling stays in one codec file', async () => {
  const sourceFiles = (await readSourceFiles([path.join('adapters', 'codex')])).filter(
    sourceFile => !sourceFile.relativePath.endsWith('.test.ts'),
  );
  const matches = findForbiddenMatches(
    sourceFiles,
    /\bserver-request\b|runtime-host-requested/g,
  );
  const allowedFiles = [
    path.join('adapters', 'codex', 'codec', 'event', 'decode-codex-message.ts'),
    path.join('adapters', 'codex', 'codec', 'event', 'decode-server-request-placeholder.ts'),
    path.join('adapters', 'codex', 'protocol', 'codex-message.ts'),
    path.join('adapters', 'codex', 'transport', 'create-jsonl-transport.ts'),
  ];
  const violations = matches.filter(match => !allowedFiles.includes(match.relativePath));

  assert.deepEqual(violations, []);
});

test('thread public state does not export runtime thread records', async () => {
  const sourceFiles = await readSourceFiles([path.join('features', 'thread')]);
  const publicSourceFiles = sourceFiles.filter(
    sourceFile => sourceFile.relativePath.endsWith('thread-events.ts') || sourceFile.relativePath.endsWith('index.ts'),
  );
  const matches = findForbiddenMatches(publicSourceFiles, /\bRuntimeThread\b/g);

  assert.deepEqual(matches, []);
});
