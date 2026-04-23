import type { SessionError, SessionTimelineItem, SessionTimelineMessageItem } from '../session-types';

function hasTurnId(error: SessionError | null | undefined): error is SessionError & { turnId: string } {
  return typeof error?.turnId === 'string' && error.turnId.length > 0;
}

export function isConversationScopedTurnError(
  error: SessionError | null | undefined,
): error is SessionError & { turnId: string } {
  return hasTurnId(error) && error.presentationScope === 'conversation';
}

function createConversationScopedTurnErrorMessage(
  error: SessionError & { turnId: string },
): SessionTimelineMessageItem {
  return {
    id: `turn-error:${error.turnId}`,
    kind: 'message',
    itemType: 'agentMessage',
    role: 'assistant',
    text: error.message,
    state: 'error',
    threadId: error.threadId,
    turnId: error.turnId,
    raw: {
      type: 'turnError',
      error,
    },
  };
}

function findLastMessageIndexByTurnId(messages: SessionTimelineItem[], turnId: string) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.turnId === turnId) {
      return index;
    }
  }

  return -1;
}

export function applyConversationScopedTurnError(
  messages: SessionTimelineItem[],
  error: SessionError | null | undefined,
) {
  if (!isConversationScopedTurnError(error)) {
    return messages;
  }

  const errorMessage = createConversationScopedTurnErrorMessage(error);
  const nextMessages = messages.filter(message => message.id !== errorMessage.id);
  const insertionIndex = findLastMessageIndexByTurnId(nextMessages, error.turnId);

  if (insertionIndex === -1) {
    return [...nextMessages, errorMessage];
  }

  return [
    ...nextMessages.slice(0, insertionIndex + 1),
    errorMessage,
    ...nextMessages.slice(insertionIndex + 1),
  ];
}

export function getSharedErrorMessage(error: SessionError | null | undefined) {
  if (isConversationScopedTurnError(error)) {
    return '';
  }

  return error?.message || '';
}
