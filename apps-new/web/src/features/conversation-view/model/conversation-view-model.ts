import type { ClientConversationItem, ClientConversationView } from '@my-code-x/contracts-new';

export type ConversationViewModel =
  | ConversationViewLoadingModel
  | ConversationViewEmptyModel
  | ConversationViewTimelineModel
  | ConversationViewFailedModel;

export interface ConversationViewLoadingModel {
  readonly status: 'loading';
}

export interface ConversationViewEmptyModel {
  readonly status: 'empty';
  readonly revision: number;
}

export interface ConversationViewTimelineModel {
  readonly status: 'timeline';
  readonly revision: number;
  readonly items: readonly ClientConversationItem[];
}

export interface ConversationViewFailedModel {
  readonly status: 'failed';
  readonly error: ConversationViewModelError;
}

export interface ConversationViewModelError {
  readonly message: string;
}

export interface CreateConversationViewModelFromSnapshotInput {
  readonly conversation: ClientConversationView;
}

export function createConversationViewModelFromSnapshot(
  input: CreateConversationViewModelFromSnapshotInput,
): ConversationViewModel {
  switch (input.conversation.status) {
    case 'loading':
      return {
        status: 'loading',
      };

    case 'ready':
      if (input.conversation.items.length === 0) {
        return {
          status: 'empty',
          revision: input.conversation.revision,
        };
      }

      return {
        status: 'timeline',
        revision: input.conversation.revision,
        items: input.conversation.items,
      };

    case 'failed':
      return {
        status: 'failed',
        error: input.conversation.error,
      };
  }
}
