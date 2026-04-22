import fsp from 'node:fs/promises';
import path from 'node:path';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function ensureFileParent(filePath) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
}

export async function readJsonFileWithRetry(filePath, { attempts = 5, delayMs = 40 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let text = '';

    try {
      text = await fsp.readFile(filePath, 'utf8');
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return null;
      }
      throw error;
    }

    if (!text.trim()) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      if (!(error instanceof SyntaxError) || attempt === attempts) {
        throw error;
      }
      await sleep(delayMs * attempt);
    }
  }

  return null;
}

export async function writeJsonFileAtomic(filePath, value) {
  await ensureFileParent(filePath);
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`,
  );

  await fsp.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');

  let lastError = null;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      await fsp.rename(temporaryPath, filePath);
      return;
    } catch (error) {
      lastError = error;
      if (error?.code !== 'EEXIST' && error?.code !== 'EPERM') {
        break;
      }

      await fsp.rm(filePath, { force: true }).catch(() => {});
      await sleep(20 * attempt);
    }
  }

  await fsp.rm(temporaryPath, { force: true }).catch(() => {});
  throw lastError;
}
