import { readString } from '../reader/index.js';
import type { RuntimeEvent } from '../../../../ports/index.js';
import type { DecodeCodexNotificationInput } from './codex-notification-input.js';

export function decodeHostRequestEvent(input: DecodeCodexNotificationInput): RuntimeEvent | null {
  switch (input.method) {
    case 'serverRequest/resolved':
      return {
        kind: 'runtime-host-request-resolved',
        threadId: readString(input.params.threadId, 'Codex serverRequest/resolved threadId'),
        requestId: readString(input.params.requestId, 'Codex serverRequest/resolved requestId'),
      };

    default:
      return null;
  }
}
