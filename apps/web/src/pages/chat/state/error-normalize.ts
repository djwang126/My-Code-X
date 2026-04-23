import { SessionApiError } from '../../../shared/lib/app-api-client';

import type { ChatPageError, ChatPageErrorKind } from './page-state-types';

type ChatPageActionErrorInput = ChatPageError;

type ChatPageErrorNormalizationInput = {
  kind: ChatPageErrorKind;
  error: unknown;
  fallbackMessage: string;
};

export class ChatPageActionError extends Error {
  readonly kind: ChatPageErrorKind;

  constructor(input: ChatPageActionErrorInput) {
    super(input.message);
    this.name = 'ChatPageActionError';
    this.kind = input.kind;
  }
}

export function createChatPageActionError(input: ChatPageActionErrorInput) {
  return new ChatPageActionError(input);
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return '';
}

export function normalizeChatPageError<Kind extends ChatPageErrorKind>(
  input: Omit<ChatPageErrorNormalizationInput, 'kind'> & { kind: Kind },
): { kind: Kind; message: string } {
  if (input.error instanceof ChatPageActionError) {
    return {
      kind: input.error.kind as Kind,
      message: input.error.message,
    };
  }

  if (input.error instanceof SessionApiError) {
    return {
      kind: input.kind,
      message: input.error.message,
    };
  }

  const message = readErrorMessage(input.error);
  return {
    kind: input.kind,
    message: message || input.fallbackMessage,
  };
}
