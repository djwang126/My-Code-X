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
const importPattern = /^import\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"];?/gm;

const allowedBoundaryImports: Record<string, readonly string[]> = {
  'adapters/codex': ['adapters/codex', 'ports', 'shared'],
  'adapters/memory': ['adapters/memory', 'ports', 'shared'],
  application: ['application', 'features/*', 'ports', 'shared'],
  config: ['config', 'shared'],
  'features/app-control': ['features/app-control', 'ports', 'shared'],
  'features/chat': ['features/chat', 'ports', 'shared'],
  'features/session': ['features/session', 'ports', 'shared'],
  'features/thread': ['features/thread', 'ports', 'shared'],
  'features/workspace': ['features/workspace', 'ports', 'shared'],
  http: ['http', 'application', 'shared'],
  main: ['main', 'config', 'http', 'application', 'features/*', 'adapters/*', 'ports', 'shared'],
  ports: ['ports', 'shared'],
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

  return rest.length ? layer : 'root';
}

function resolveImportBoundary(sourceFile: SourceFile, importPath: string): string | null {
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
