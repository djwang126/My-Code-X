import type { JsonValue } from '@my-code-x/contracts-new/json';

export interface EncodeRuntimeHostResponseInput {
  readonly response: JsonValue;
}

export function encodeRuntimeHostResponseToCodexResult(input: EncodeRuntimeHostResponseInput): JsonValue {
  return input.response;
}
