import type {
  ChatInterruptAcceptedPayload,
  ChatMessageAcceptedPayload,
  SessionSendContentItem,
} from '../session-types';
import type { RuntimeSettings } from '../../runtime-settings';
import { postJson } from '../../../shared/lib/app-api-client';
import { parseChatInterruptAcceptedPayload, parseChatMessageAcceptedPayload } from '../lib/session-payload-parse';

function sanitizeRuntimeSettings(runtimeSettings?: RuntimeSettings) {
  if (!runtimeSettings) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(runtimeSettings).filter(
      ([key, value]) => !(key === 'collaborationModeKind' && (value === null || value === '')),
    ),
  );
}

export async function postChatMessage({
  viewerId,
  slotId,
  workspace,
  threadId,
  text,
  content,
  runtimeSettings,
}: {
  viewerId: string;
  slotId: string;
  workspace: string;
  threadId?: string;
  text?: string;
  content?: SessionSendContentItem[];
  runtimeSettings?: RuntimeSettings;
}): Promise<ChatMessageAcceptedPayload> {
  const sanitizedRuntimeSettings = sanitizeRuntimeSettings(runtimeSettings);
  const trimmedText = String(text || '').trim();

  return postJson<ChatMessageAcceptedPayload>({
    url: '/api/v2/chat/message',
    body: {
      viewerId,
      slotId,
      workspace,
      ...(threadId ? { threadId } : {}),
      ...(Array.isArray(content) && content.length ? { content } : { text: trimmedText }),
      ...(sanitizedRuntimeSettings ? { runtimeSettings: sanitizedRuntimeSettings } : {}),
    },
    parseResponse: parseChatMessageAcceptedPayload,
  });
}

export async function postChatInterrupt({
  slotId,
  threadId,
}: {
  slotId: string;
  threadId: string;
}): Promise<ChatInterruptAcceptedPayload> {
  return postJson<ChatInterruptAcceptedPayload>({
    url: '/api/v2/chat/interrupt',
    body: {
      slotId,
      threadId,
    },
    parseResponse: parseChatInterruptAcceptedPayload,
  });
}
