import fsp from 'node:fs/promises';

import { formatCliErrorMessage } from '../shared/cli-error-output.mjs';

const DEFAULT_LOG_EXCERPT_LINE_COUNT = 20;

export function formatStartSuccess({ state, exposeMode, port }) {
  const localUrl = state?.localUrl || `http://127.0.0.1:${port}/`;
  const exposureUrls = Array.isArray(state?.exposureUrls) ? state.exposureUrls.filter(Boolean) : [];
  const lines = [
    'My-Code-X started successfully.',
    `mode: ${exposeMode}`,
    `local: ${localUrl}`,
  ];

  if (exposureUrls[0]) {
    lines.push(`remote: ${exposureUrls[0]}`);
  }

  return `${lines.join('\n')}\n`;
}

export function buildLogExcerpt(text, lineCount = DEFAULT_LOG_EXCERPT_LINE_COUNT) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map(line => line.trimEnd())
    .filter(line => line.trim());

  if (!lines.length) {
    return '';
  }

  return lines.slice(-lineCount).join('\n');
}

async function readLogExcerpt(filePath, lineCount = DEFAULT_LOG_EXCERPT_LINE_COUNT) {
  if (!filePath) {
    return '';
  }

  try {
    const text = await fsp.readFile(filePath, 'utf8');
    return buildLogExcerpt(text, lineCount);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return '';
    }

    throw error;
  }
}

function appendSection(lines, title, content) {
  if (!content) {
    return;
  }

  lines.push('');
  lines.push(`${title}:`);
  lines.push(content);
}

export async function buildStartFailureMessage({ error, state, paths }) {
  const primaryError = state?.lastError?.trim() || formatCliErrorMessage(error);
  const [supervisorError, backendError] = await Promise.all([
    readLogExcerpt(paths?.supervisorErrLog),
    readLogExcerpt(paths?.backendErrLog),
  ]);
  const lines = [
    'My-Code-X failed to start.',
    `error: ${primaryError}`,
  ];

  appendSection(lines, 'supervisor stderr', supervisorError);
  appendSection(lines, 'backend stderr', backendError);

  return lines.join('\n');
}
