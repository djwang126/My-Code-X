import { CodexProtocolError } from '../../errors/codex-runtime-error.js';
import type { RuntimeResult } from '../../../../ports/index.js';
import type { DecodeCodexResultInput } from './codex-result-input.js';
import { decodeGenericResult } from './decode-generic-result.js';
import { decodeThreadQueryResult } from './decode-thread-query-result.js';
import { decodeThreadResult } from './decode-thread-result.js';
import { decodeTurnResult } from './decode-turn-result.js';

export type { DecodeCodexResultInput } from './codex-result-input.js';

export function decodeCodexResultToRuntimeResult(input: DecodeCodexResultInput): RuntimeResult {
  const result = decodeThreadResult(input)
    ?? decodeThreadQueryResult(input)
    ?? decodeTurnResult(input)
    ?? decodeGenericResult(input);

  if (!result) {
    throw new CodexProtocolError(`Unsupported runtime command result: ${input.command.kind}`);
  }

  return result;
}
