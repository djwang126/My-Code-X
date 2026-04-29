import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { CodexProcessStartError } from '../runtime/codex-runtime-error.js';
import type { EnvironmentVariables } from '../../../shared/index.js';

export interface StartCodexProcessInput {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env: EnvironmentVariables;
}

export function startCodexProcess(input: StartCodexProcessInput): ChildProcessWithoutNullStreams {
  try {
    if (!existsSync(input.cwd)) {
      throw new CodexProcessStartError(`Codex working directory does not exist: ${input.cwd}`);
    }

    return spawn(input.command, [...input.args], {
      cwd: input.cwd,
      env: input.env,
      shell: shouldUseShell(input.command),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CodexProcessStartError(message);
  }
}

function shouldUseShell(command: string): boolean {
  return process.platform === 'win32' && !path.isAbsolute(command);
}
