import type { CodexIncomingMessage } from '../../protocol/codex-message.js';
import { readOptionalString } from '../reader/index.js';
import type { JsonObject } from '@my-code-x/contracts-new/json';
import type { RuntimeEvent } from '../../../../ports/index.js';

// Temporary bridge only.
// Runtime request semantics, approval workflows, and pending request ownership are not modeled here.
// This decoder preserves an external host request as a placeholder runtime event.
interface CodexServerRequestInput {
  readonly message: Extract<CodexIncomingMessage, { readonly kind: 'server-request' }>;
}

export function decodeServerRequestPlaceholderToRuntimeEvent(input: CodexServerRequestInput): RuntimeEvent {
  return {
    kind: 'runtime-host-requested',
    requestId: input.message.id,
    threadId: readServerRequestThreadId(input.message.params),
    turnId: readOptionalString(input.message.params.turnId, 'Codex server request turnId'),
    itemId: readOptionalString(input.message.params.itemId, 'Codex server request itemId'),
    data: input.message.params,
  };
}

function readServerRequestThreadId(params: JsonObject): string | null {
  return readOptionalString(params.threadId, 'Codex server request threadId')
    ?? readOptionalString(params.conversationId, 'Codex server request conversationId');
}



