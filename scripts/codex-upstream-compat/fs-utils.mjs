import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export async function ensureDir(dirPath) {
  await fsp.mkdir(dirPath, { recursive: true });
}

export async function removeDirIfExists(dirPath) {
  await fsp.rm(dirPath, { recursive: true, force: true }).catch(error => {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  });
}

async function makeTempDir(prefix) {
  return fsp.mkdtemp(path.join(os.tmpdir(), prefix));
}

export function normalizeJsonValue(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeJsonValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, entryValue]) => [key, normalizeJsonValue(entryValue)]),
    );
  }

  return value;
}

export function normalizeRelativePath(relativePath) {
  return path.normalize(String(relativePath || '').replaceAll('/', path.sep).replaceAll('\\', path.sep));
}

export async function collectRelativeFiles(rootDir) {
  const entries = [];

  async function walk(currentDir) {
    const children = await fsp.readdir(currentDir, { withFileTypes: true });
    children.sort((left, right) => left.name.localeCompare(right.name));

    for (const child of children) {
      const absolutePath = path.join(currentDir, child.name);
      if (child.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      entries.push(path.relative(rootDir, absolutePath));
    }
  }

  await walk(rootDir);
  return entries;
}

export async function copyNormalizedTree(sourceDir, targetDir) {
  await removeDirIfExists(targetDir);
  await ensureDir(targetDir);

  const files = await collectRelativeFiles(sourceDir);
  for (const relativePath of files) {
    const sourcePath = path.join(sourceDir, relativePath);
    const targetPath = path.join(targetDir, relativePath);
    await ensureDir(path.dirname(targetPath));

    if (relativePath.endsWith('.json')) {
      const parsed = JSON.parse(await fsp.readFile(sourcePath, 'utf8'));
      const normalized = `${JSON.stringify(normalizeJsonValue(parsed), null, 2)}\n`;
      await fsp.writeFile(targetPath, normalized, 'utf8');
      continue;
    }

    await fsp.copyFile(sourcePath, targetPath);
  }
}

export async function normalizeGeneratedTree(sourceDir) {
  const normalizedDir = await makeTempDir('codex-schema-normalized-');
  await copyNormalizedTree(sourceDir, normalizedDir);
  return normalizedDir;
}

export async function readJsonFile(filePath) {
  try {
    return JSON.parse(await fsp.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

export async function readNormalizedJsonText(filePath) {
  const parsed = await readJsonFile(filePath);
  return `${JSON.stringify(normalizeJsonValue(parsed), null, 2)}\n`;
}
