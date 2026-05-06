import type { ClientConversationItem, ClientConversationView } from '@my-code-x/contracts-new';
import type { ConversationItem, ConversationReadySnapshot, ConversationSnapshot } from '../features/conversation/index.js';

export interface PresentConversationInput {
  readonly snapshot: ConversationReadySnapshot;
}

export interface PresentConversationViewInput {
  readonly snapshot: ConversationSnapshot;
}

export function presentReadyConversationItems(input: PresentConversationInput): readonly ClientConversationItem[] {
  return input.snapshot.items.map(item => presentConversationItem({ item }));
}

export function presentConversationView(input: PresentConversationViewInput): ClientConversationView {
  switch (input.snapshot.status) {
    case 'ready':
      return {
        status: 'ready',
        revision: input.snapshot.revision,
        items: presentReadyConversationItems({ snapshot: input.snapshot }),
      };

    case 'failed':
      return {
        status: 'failed',
        revision: input.snapshot.revision,
        error: input.snapshot.error,
      };
  }
}

export interface PresentConversationItemInput {
  readonly item: ConversationItem;
}

export function presentConversationItem(input: PresentConversationItemInput): ClientConversationItem {
  switch (input.item.kind) {
    case 'message':
      return {
        id: input.item.id,
        kind: 'message',
        role: input.item.role,
        text: input.item.text,
      };

    case 'work-trace':
      return {
        id: input.item.id,
        kind: 'work-trace',
        codexType: input.item.codexType,
        fields: input.item.fields,
      };

    case 'unknown':
      return {
        id: input.item.id,
        kind: 'unknown',
        codexType: input.item.codexType,
        fields: input.item.fields,
      };

    case 'error':
      return {
        id: input.item.id,
        kind: 'error',
        message: input.item.message,
      };
  }
}
