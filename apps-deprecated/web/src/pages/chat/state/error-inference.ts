import type { ChatInteractionState, ChatPageError, ChatPageErrorKind } from './page-state-types';

type InferChatPageErrorInput = {
  interactionState: ChatInteractionState;
  message: string;
  sessionErrorHint: ChatPageErrorKind | null;
};

function inferErrorKind(input: InferChatPageErrorInput): ChatPageErrorKind {
  if (input.interactionState === 'load-error') {
    return 'bootstrap';
  }

  return input.sessionErrorHint ?? 'unknown';
}

export function inferChatPageError(input: InferChatPageErrorInput): ChatPageError | null {
  const message = input.message.trim();
  if (!message) {
    return null;
  }

  return {
    kind: inferErrorKind(input),
    message,
  };
}
