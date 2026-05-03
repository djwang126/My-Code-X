import { readOptionalString } from '../reader/index.js';
import type { JsonObject } from '@my-code-x/contracts-new/json';
import type { RuntimeEvent } from '../../../../ports/index.js';
import { readCodexTextLike } from '../reader/index.js';
import type { DecodeCodexNotificationInput } from './codex-notification-input.js';

export function decodeNoticeEvent(input: DecodeCodexNotificationInput): RuntimeEvent | null {
  switch (input.method) {
    case 'warning':
    case 'system/notice':
    case 'notice':
      return {
        kind: 'runtime-system-notice',
        threadId: readOptionalString(input.params.threadId, `${input.method} threadId`),
        level: readNoticeLevel(input.params),
        message: readNoticeMessage(input.params),
      };

    default:
      return null;
  }
}

function readNoticeLevel(params: JsonObject): 'info' | 'warning' | 'error' {
  const level = readCodexTextLike(params.level) ?? readCodexTextLike(params.severity) ?? 'info';

  switch (level) {
    case 'warning':
    case 'error':
      return level;
    default:
      return 'info';
  }
}

function readNoticeMessage(params: JsonObject): string {
  return readCodexTextLike(params.message) ?? readCodexTextLike(params.text) ?? 'Codex notice';
}
