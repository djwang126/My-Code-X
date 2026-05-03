import { formatUnknownCodexPayload, type CodexRuntimeLogger } from '../../diagnostics/codex-runtime-logger.js';
import type { JsonValue } from '@my-code-x/contracts-new/json';
import type { RuntimeEvent } from '../../../../ports/index.js';
import { readCodexJsonObject } from '../reader/index.js';
import type { DecodeCodexNotificationInput } from './codex-notification-input.js';
import { decodeDeltaEvent } from './decode-delta-event.js';
import { decodeHostRequestEvent } from './decode-host-request-event.js';
import { decodeItemEvent } from './decode-item-event.js';
import { decodeNoticeEvent } from './decode-notice-event.js';
import { isNoOpNotification } from './decode-passthrough-notification.js';
import { decodeRuntimeErrorEvent } from './decode-runtime-error-event.js';
import { decodeThreadEvent } from './decode-thread-event.js';
import { decodeTurnEvent } from './decode-turn-event.js';

export interface CodexNotificationInput {
  readonly method: string;
  readonly params: JsonValue;
  readonly logger: CodexRuntimeLogger;
}

export function decodeCodexNotificationToRuntimeEvent(input: CodexNotificationInput): RuntimeEvent | null {
  const notification = {
    method: input.method,
    params: readCodexJsonObject(input.params, 'Codex notification params'),
  };

  if (isNoOpNotification(notification.method, notification.params)) {
    return null;
  }

  const event = decodeKnownCodexNotification(notification);

  if (event) {
    return event;
  }

  input.logger.warn(formatUnknownCodexPayload({ method: notification.method, params: notification.params }));
  return null;
}

function decodeKnownCodexNotification(input: DecodeCodexNotificationInput): RuntimeEvent | null {
  return decodeThreadEvent(input)
    ?? decodeTurnEvent(input)
    ?? decodeItemEvent(input)
    ?? decodeDeltaEvent(input)
    ?? decodeHostRequestEvent(input)
    ?? decodeNoticeEvent(input)
    ?? decodeRuntimeErrorEvent(input);
}
