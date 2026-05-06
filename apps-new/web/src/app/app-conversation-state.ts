import type { ClientConversationView } from '@my-code-x/contracts-new';

export interface CreateFailedConversationViewInput {
  readonly current: ClientConversationView;
  readonly error: unknown;
}

export function createFailedConversationView(input: CreateFailedConversationViewInput): ClientConversationView {
  return {
    status: 'failed',
    revision: input.current.revision,
    error: {
      message: readErrorMessage(input.error),
    },
  };
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unable to load conversation';
}
