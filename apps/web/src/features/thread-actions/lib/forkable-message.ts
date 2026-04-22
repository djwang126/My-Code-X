import type { SessionTimelineItem } from '../../chat-runtime/public-types';

export function getForkableMessageIds(messages: SessionTimelineItem[]) {
  const forkableMessageIds = new Set<string>();
  const seenAssistantTurnIds = new Set<string>();

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message.kind !== 'message' || message.role !== 'assistant' || !message.turnId) {
      continue;
    }

    if (seenAssistantTurnIds.has(message.turnId)) {
      continue;
    }

    seenAssistantTurnIds.add(message.turnId);

    if (message.state === 'complete') {
      forkableMessageIds.add(message.id);
    }
  }

  return forkableMessageIds;
}
