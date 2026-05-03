import type { CodexRuntimeLogger } from '../../diagnostics/codex-runtime-logger.js';
import type { CodexIncomingMessage } from '../../protocol/codex-message.js';
import type { JsonValue } from '@my-code-x/contracts-new/json';
import type { RuntimeEvent } from '../../../../ports/index.js';
import { decodeCodexNotificationToRuntimeEvent } from './decode-codex-notification.js';
import { decodeServerRequestPlaceholderToRuntimeEvent } from './decode-server-request-placeholder.js';

export interface DecodeCodexMessageInput {
  readonly message: CodexIncomingMessage;
  readonly logger: CodexRuntimeLogger;
}

export function decodeCodexMessageToRuntimeEvent(input: DecodeCodexMessageInput): RuntimeEvent | null {
  const message = input.message;

  if (message.kind === 'server-request') {
    return decodeServerRequestPlaceholderToRuntimeEvent({ message });
  }

  if (message.kind !== 'notification') {
    return null;
  }

  return decodeCodexNotificationToRuntimeEvent({
    method: message.method,
    params: message.params as JsonValue,
    logger: input.logger,
  });
}

