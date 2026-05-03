import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

interface SourceFile {
  readonly boundary: string;
  readonly relativePath: string;
  readonly source: string;
}

interface ImportReference {
  readonly importedBoundary: string;
  readonly importedPath: string;
  readonly sourceFile: SourceFile;
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = currentDir;
const importPattern = /^(?:import|export)\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"];?/gm;

const allowedBoundaryImports: Record<string, readonly string[]> = {
  'adapters/codex': ['adapters/codex', 'ports', 'shared', 'contracts/json'],
  'adapters/memory': ['adapters/memory', 'ports', 'shared'],
  application: ['application', 'contracts/client', 'features/*', 'ports', 'presenter', 'shared'],
  config: ['config', 'shared', 'contracts/json'],
  'features/app-control': ['features/app-control', 'ports', 'shared'],
  'features/conversation': ['features/conversation', 'ports', 'shared'],
  'features/slot': ['features/slot', 'ports', 'shared'],
  'features/thread': ['features/thread', 'ports', 'shared'],
  'features/thread-actions': ['features/thread-actions', 'ports', 'shared'],
  'features/turn': ['features/turn', 'ports', 'shared'],
  'features/workspace': ['features/workspace', 'ports', 'shared'],
  http: ['http', 'application', 'contracts/client', 'contracts/json', 'shared'],
  'http/node': ['http/node', 'http', 'contracts/json', 'shared'],
  main: ['main', 'config', 'http', 'http/node', 'application', 'features/*', 'adapters/*', 'ports', 'shared'],
  presenter: ['presenter', 'contracts/client', 'features/*', 'shared'],
  ports: ['ports', 'shared', 'contracts/json'],
  shared: ['shared'],
  root: ['main'],
};

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

function toBoundary(relativePath: string): string {
  const [layer, ...rest] = relativePath.split(path.sep);

  if ((layer === 'adapters' || layer === 'features') && rest[0]) {
    return `${layer}/${rest[0]}`;
  }

  if (layer === 'http' && rest[0] === 'node') {
    return 'http/node';
  }

  return rest.length ? layer : 'root';
}

function resolveImportBoundary(sourceFile: SourceFile, importPath: string): string | null {
  const externalBoundary = resolveExternalImportBoundary(importPath);

  if (externalBoundary) {
    return externalBoundary;
  }

  if (!importPath.startsWith('.')) {
    return null;
  }

  const absoluteImportPath = path.resolve(srcRoot, path.dirname(sourceFile.relativePath), importPath);
  const relativeImportPath = path.relative(srcRoot, absoluteImportPath);

  if (relativeImportPath.startsWith('..')) {
    return null;
  }

  return toBoundary(relativeImportPath);
}

function resolveExternalImportBoundary(importPath: string): string | null {
  if (importPath === '@my-code-x/contracts-new') {
    return 'contracts/client';
  }

  if (importPath === '@my-code-x/contracts-new/json') {
    return 'contracts/json';
  }

  if (importPath.startsWith('@my-code-x/contracts-new/')) {
    return 'contracts/unknown';
  }

  return null;
}

function findImportReferences(sourceFile: SourceFile): readonly ImportReference[] {
  const references: ImportReference[] = [];
  const matches = sourceFile.source.matchAll(importPattern);

  for (const match of matches) {
    const importedPath = match[1] ?? '';
    const importedBoundary = resolveImportBoundary(sourceFile, importedPath);

    if (!importedBoundary) {
      continue;
    }

    references.push({ importedBoundary, importedPath, sourceFile });
  }

  return references;
}

function isAllowedImport(allowedImports: readonly string[], importedBoundary: string): boolean {
  for (const allowedImport of allowedImports) {
    if (allowedImport.endsWith('/*')) {
      const prefix = allowedImport.slice(0, -1);

      if (importedBoundary.startsWith(prefix)) {
        return true;
      }

      continue;
    }

    if (allowedImport === importedBoundary) {
      return true;
    }
  }

  return false;
}

test('server-new external contract imports are separated by client protocol and JSON foundation', () => {
  assert.equal(resolveExternalImportBoundary('@my-code-x/contracts-new'), 'contracts/client');
  assert.equal(resolveExternalImportBoundary('@my-code-x/contracts-new/json'), 'contracts/json');
  assert.equal(resolveExternalImportBoundary('@my-code-x/contracts-new/internal'), 'contracts/unknown');

  assert.equal(isAllowedImport(allowedBoundaryImports['adapters/codex'] ?? [], 'contracts/json'), true);
  assert.equal(isAllowedImport(allowedBoundaryImports['adapters/codex'] ?? [], 'contracts/client'), false);
  assert.equal(isAllowedImport(allowedBoundaryImports.presenter ?? [], 'contracts/client'), true);
  assert.equal(isAllowedImport(allowedBoundaryImports.http ?? [], 'contracts/unknown'), false);
  assert.equal(toBoundary(path.join('http', 'node', 'node-http-server.ts')), 'http/node');
  assert.equal(isAllowedImport(allowedBoundaryImports.http ?? [], 'http/node'), false);
  assert.equal(isAllowedImport(allowedBoundaryImports.main ?? [], 'http/node'), true);
});

test('server-new import boundaries follow the architecture direction', async () => {
  const absoluteFiles = await listSourceFiles(srcRoot);
  const sourceFiles: SourceFile[] = [];

  for (const absoluteFile of absoluteFiles) {
    const relativePath = path.relative(srcRoot, absoluteFile);
    sourceFiles.push({
      boundary: toBoundary(relativePath),
      relativePath,
      source: await readFile(absoluteFile, 'utf-8'),
    });
  }

  const violations: string[] = [];

  for (const sourceFile of sourceFiles) {
    const allowedImports = allowedBoundaryImports[sourceFile.boundary] ?? [];
    const references = findImportReferences(sourceFile);

    for (const reference of references) {
      if (isAllowedImport(allowedImports, reference.importedBoundary)) {
        continue;
      }

      violations.push(`${reference.sourceFile.relativePath} imports ${reference.importedPath}`);
    }
  }

  assert.deepEqual(violations, []);
});
