import type { JsonObject, JsonValue } from '@my-code-x/contracts-new/json';

export function nullToUndefined<T>(value: T | null | undefined): T | undefined {
  return value === null || value === undefined ? undefined : value;
}

export function cleanJsonObject(input: Record<string, JsonValue | undefined>): JsonObject {
  const output: Record<string, JsonValue> = {};

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) {
      continue;
    }

    output[key] = value;
  }

  return output;
}
