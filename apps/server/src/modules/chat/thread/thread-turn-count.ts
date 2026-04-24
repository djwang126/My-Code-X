import type { ChatTimelineItem } from '../shared/chat-types.js';

export function countDistinctUserTurns(messages: ChatTimelineItem[], threadId: string) {
  const turnIds = new Set<string>();

  for (const message of messages) {
    if (message.kind !== 'message') {
      continue;
    }

    if (message.role !== 'user') {
      continue;
    }

    if (message.threadId !== threadId) {
      continue;
    }

    if (!message.turnId) {
      continue;
    }

    turnIds.add(message.turnId);
  }

  return turnIds.size;
}
