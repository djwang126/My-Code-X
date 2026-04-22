import fs from 'node:fs';
import process from 'node:process';

const ENV_LINE_PATTERN = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;

type EnvMap = Record<string, string | undefined>;
type ReadFileSync = (filePath: string, encoding: 'utf8') => string;
type ErrorWithCode = Error & { code?: string };

export interface ParseEnvValueInput {
  lineNumber: number;
  source: string;
}

export interface ParseEnvFileInput {
  source?: string;
}

export interface ReadEnvFileInput {
  readFileSync?: ReadFileSync;
}

export interface ApplyEnvFileToEnvInput extends ReadEnvFileInput {
  filePath?: string;
  env?: EnvMap;
}

function decodeDoubleQuotedValue(value: string): string {
  return value.replace(/\\([nrt"\\])/g, (_match, token: string) => {
    if (token === 'n') return '\n';
    if (token === 'r') return '\r';
    if (token === 't') return '\t';
    return token;
  });
}

function findInlineCommentIndex(value: string): number {
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== '#') {
      continue;
    }

    if (index === 0 || /\s/.test(value[index - 1] ?? '')) {
      return index;
    }
  }

  return -1;
}

function parseEnvValue(rawValue: unknown, { lineNumber, source }: ParseEnvValueInput): string {
  const trimmedValue = String(rawValue ?? '').trim();

  if (!trimmedValue) {
    return '';
  }

  if (trimmedValue.startsWith('"')) {
    if (!trimmedValue.endsWith('"') || trimmedValue.length === 1) {
      throw new Error(`${source} contains an unterminated double-quoted value on line ${lineNumber}`);
    }

    return decodeDoubleQuotedValue(trimmedValue.slice(1, -1));
  }

  if (trimmedValue.startsWith("'")) {
    if (!trimmedValue.endsWith("'") || trimmedValue.length === 1) {
      throw new Error(`${source} contains an unterminated single-quoted value on line ${lineNumber}`);
    }

    return trimmedValue.slice(1, -1);
  }

  const commentIndex = findInlineCommentIndex(trimmedValue);
  const valueWithoutComment = commentIndex === -1 ? trimmedValue : trimmedValue.slice(0, commentIndex).trimEnd();
  return valueWithoutComment;
}

export function parseEnvFile(text: unknown, { source = '.env' }: ParseEnvFileInput = {}): Record<string, string> {
  const parsed: Record<string, string> = {};
  const lines = String(text ?? '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/);

  for (const [lineIndex, line] of lines.entries()) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    const match = line.match(ENV_LINE_PATTERN);
    if (!match) {
      throw new Error(`${source} contains an invalid env assignment on line ${lineIndex + 1}`);
    }

    const [, key, rawValue = ''] = match;
    parsed[key] = parseEnvValue(rawValue, {
      lineNumber: lineIndex + 1,
      source,
    });
  }

  return parsed;
}

export function readEnvFile(filePath: string, { readFileSync = fs.readFileSync }: ReadEnvFileInput = {}): Record<string, string> {
  try {
    const text = readFileSync(filePath, 'utf8');
    return parseEnvFile(text, { source: filePath });
  } catch (error) {
    if ((error as ErrorWithCode | undefined)?.code === 'ENOENT') {
      return {};
    }

    throw error;
  }
}

export function applyEnvFileToEnv({
  filePath = '',
  env = process.env,
  readFileSync = fs.readFileSync,
}: ApplyEnvFileToEnvInput = {}): EnvMap {
  const parsed = readEnvFile(filePath, { readFileSync });

  for (const [key, value] of Object.entries(parsed)) {
    if (!(key in env)) {
      env[key] = value;
    }
  }

  return env;
}
