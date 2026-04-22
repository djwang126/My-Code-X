import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

type EnvMap = Record<string, string | undefined>;

export interface BuildMyCodeXEnvPathsInput {
  installRoot: string;
  userDir?: string;
  homeDir?: string;
}

export interface LoadMyCodeXUserEnvInput extends BuildMyCodeXEnvPathsInput {
  env?: EnvMap;
}

function isWindowsDrivePath(value: string): boolean {
  return /^[A-Za-z]:[\\/]/u.test(value);
}

function isWindowsUncPath(value: string): boolean {
  return /^\\\\[^\\]+\\[^\\]+/u.test(value);
}

export function isAbsoluteUserPath(value: string): boolean {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return false;
  }

  return path.isAbsolute(trimmed) || isWindowsDrivePath(trimmed) || isWindowsUncPath(trimmed);
}

export function resolveMyCodeXUserDir(userDir = '', homeDir = os.homedir()): string {
  const trimmed = String(userDir || '').trim();
  if (!trimmed) {
    return path.join(homeDir, '.My-Code-X');
  }

  return isAbsoluteUserPath(trimmed) ? trimmed : path.resolve(homeDir, trimmed);
}

export function buildMyCodeXEnvPaths({ installRoot, userDir = '', homeDir = os.homedir() }: BuildMyCodeXEnvPathsInput) {
  return {
    userDir: resolveMyCodeXUserDir(userDir, homeDir),
    envExampleFile: path.join(installRoot, '.env.example'),
    envFile: path.join(resolveMyCodeXUserDir(userDir, homeDir), '.env'),
  };
}

export function parseEnvFile(text: unknown): Record<string, string> {
  const values: Record<string, string> = {};

  for (const rawLine of String(text || '').split(/\r?\n/u)) {
    const trimmedLine = rawLine.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    if (!key) {
      continue;
    }

    let value = trimmedLine.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

export function ensureMyCodeXUserEnvFile({ installRoot, userDir = '', homeDir = os.homedir() }: BuildMyCodeXEnvPathsInput) {
  const paths = buildMyCodeXEnvPaths({ installRoot, userDir, homeDir });
  fs.mkdirSync(paths.userDir, { recursive: true });

  if (!fs.existsSync(paths.envFile) && fs.existsSync(paths.envExampleFile)) {
    fs.copyFileSync(paths.envExampleFile, paths.envFile);
    return { ...paths, created: true };
  }

  return { ...paths, created: false };
}

export function loadMyCodeXUserEnv({
  installRoot,
  userDir = '',
  homeDir = os.homedir(),
  env = process.env,
}: LoadMyCodeXUserEnvInput) {
  const ensured = ensureMyCodeXUserEnvFile({ installRoot, userDir, homeDir });
  const loadedKeys: string[] = [];

  if (!fs.existsSync(ensured.envFile)) {
    return { ...ensured, loadedKeys };
  }

  const parsed = parseEnvFile(fs.readFileSync(ensured.envFile, 'utf8'));
  for (const [key, value] of Object.entries(parsed)) {
    if (env[key] !== undefined) {
      continue;
    }

    env[key] = value;
    loadedKeys.push(key);
  }

  return { ...ensured, loadedKeys };
}
