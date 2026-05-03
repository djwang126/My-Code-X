import type { RuntimeResult } from '../../../../ports/index.js';

export function cleanRuntimeResult<T extends RuntimeResult>(result: T): T {
  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(result)) {
    if (value !== undefined) {
      output[key] = value;
    }
  }

  return output as T;
}
