import type { CodexRequest } from '../../protocol/codex-request.js';
import { cleanJsonObject } from './clean-json-object.js';

export interface EncodeThreadIdRequestInput {
  readonly method: string;
  readonly threadId: string;
}

export function encodeThreadIdRequest(input: EncodeThreadIdRequestInput): CodexRequest {
  return {
    method: input.method,
    params: cleanJsonObject({
      threadId: input.threadId,
    }),
  };
}

