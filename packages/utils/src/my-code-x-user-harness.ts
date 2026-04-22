import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { resolveMyCodeXUserDir } from './my-code-x-user-env.js';

type ErrorWithCode = Error & { code?: string };

export interface BuildMyCodeXCustomHarnessPathsInput {
  installRoot: string;
  userDir?: string;
  homeDir?: string;
}

export function resolveMyCodeXCustomHarnessDir({ userDir = '', homeDir = os.homedir() }: Omit<BuildMyCodeXCustomHarnessPathsInput, 'installRoot'> = {}): string {
  return path.join(resolveMyCodeXUserDir(userDir, homeDir), 'custom-harness');
}

export function buildMyCodeXCustomHarnessPaths({
  installRoot,
  userDir = '',
  homeDir = os.homedir(),
}: BuildMyCodeXCustomHarnessPathsInput) {
  return {
    sourceDir: path.join(installRoot, 'custom-harness'),
    targetDir: resolveMyCodeXCustomHarnessDir({ userDir, homeDir }),
  };
}

export async function ensureMyCodeXCustomHarness({
  installRoot,
  userDir = '',
  homeDir = os.homedir(),
}: BuildMyCodeXCustomHarnessPathsInput) {
  const paths = buildMyCodeXCustomHarnessPaths({ installRoot, userDir, homeDir });
  await fs.mkdir(path.dirname(paths.targetDir), { recursive: true });

  const sourceStats = await fs.stat(paths.sourceDir).catch(error => {
    if ((error as ErrorWithCode | undefined)?.code === 'ENOENT') {
      return null;
    }

    throw error;
  });

  if (!sourceStats?.isDirectory()) {
    return { ...paths, created: false };
  }

  const targetStats = await fs.stat(paths.targetDir).catch(error => {
    if ((error as ErrorWithCode | undefined)?.code === 'ENOENT') {
      return null;
    }

    throw error;
  });

  if (targetStats) {
    return { ...paths, created: false };
  }

  await fs.cp(paths.sourceDir, paths.targetDir, { recursive: true });
  return { ...paths, created: true };
}
