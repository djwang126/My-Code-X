import type { RuntimeEvent } from '../../../../ports/index.js';

export function cleanRuntimeEvent<T extends RuntimeEvent>(event: T): T {
  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(event)) {
    if (value !== undefined) {
      output[key] = value;
    }
  }

  return output as T;
}
