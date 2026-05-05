import type { JsonValue } from '@my-code-x/contracts-new/json';
import type { RuntimeErrorInfo } from '../../../../ports/index.js';
import { readCodexJsonObject, readCodexJsonObjectOrNull, readCodexTextLike } from '../../protocol/reader/index.js';

export function readCodexRuntimeError(value: JsonValue): RuntimeErrorInfo {
  if (typeof value === 'string') {
    return { message: value, code: null };
  }

  const payload = readCodexJsonObject(value, 'Codex runtime error');
  const details = readCodexTextLike(payload.additionalDetails);
  return cleanRuntimeError({
    message: readCodexTextLike(payload.message) ?? readCodexTextLike(payload.reason) ?? 'Codex runtime error',
    code: readCodexTextLike(payload.code) ?? readCodexErrorCode(payload.codexErrorInfo),
    details: details ?? undefined,
  });
}


function readCodexErrorCode(value: JsonValue | undefined): string | null {
  if (typeof value === 'string') {
    return value;
  }

  const payload = readCodexJsonObjectOrNull(value);
  if (!payload) {
    return null;
  }

  return Object.keys(payload)[0] ?? null;
}

function cleanRuntimeError(error: RuntimeErrorInfo): RuntimeErrorInfo {
  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(error)) {
    if (value !== undefined) {
      output[key] = value;
    }
  }

  return output as unknown as RuntimeErrorInfo;
}

