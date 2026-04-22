import { isPageScopedChatPageError } from './chat-page-error-policy';
import type { ChatPageError, ChatPageFeedback } from './chat-page-state-types';

export function selectChatPageFeedback(error: ChatPageError | null): ChatPageFeedback | null {
  if (!error) {
    return null;
  }

  const message = error.message.trim();

  if (!message || !isPageScopedChatPageError(error.kind)) {
    return null;
  }

  return {
    scope: 'page',
    error: {
      kind: error.kind,
      message,
    },
  };
}
