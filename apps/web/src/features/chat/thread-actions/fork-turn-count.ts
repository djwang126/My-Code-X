import type { SessionTimelineItem } from '../runtime';

export function getPreservedTurnCountForForkTarget(messages: SessionTimelineItem[], messageId: string) {
  const targetIndex = messages.findIndex(message => message.id === messageId);
  if (targetIndex < 0) {
    return 0;
  }

  const targetMessage = messages[targetIndex];
  if (targetMessage.kind !== 'message' || targetMessage.role !== 'assistant' || targetMessage.state !== 'complete') {
    return 0;
  }

  return new Set(
    messages
      .slice(0, targetIndex + 1)
      .flatMap(message =>
        message.kind === 'message' && message.role === 'user' && message.turnId ? [message.turnId] : [],
      ),
  ).size;
}
