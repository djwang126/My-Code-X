import { readOptionalString } from '../reader/index.js';
import type { RuntimeEvent } from '../../../../ports/index.js';
import { readCodexRuntimeError, readCodexTextLike } from '../reader/index.js';
import type { DecodeCodexNotificationInput } from './codex-notification-input.js';

export function decodeRuntimeErrorEvent(input: DecodeCodexNotificationInput): RuntimeEvent | null {
  const params = input.params;

  switch (input.method) {
    case 'error':
      return {
        kind: 'runtime-error',
        threadId: readOptionalString(params.threadId, 'Codex error threadId'),
        turnId: readOptionalString(params.turnId, 'Codex error turnId'),
        error: readCodexRuntimeError(params.error ?? params),
      };

    case 'thread/realtime/error':
      return {
        kind: 'runtime-error',
        threadId: readOptionalString(params.threadId, 'Codex thread/realtime/error threadId'),
        turnId: null,
        error: {
          message: readCodexTextLike(params.message) ?? readCodexTextLike(params.reason) ?? 'codex realtime error',
          code: null,
        },
      };

    default:
      return null;
  }
}
