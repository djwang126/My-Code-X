import type { ClientConversationItem, ClientItemBody, ClientItemDetail } from '../contracts/index.js';
import type { ConversationItem, ConversationItemKind, ConversationSnapshot } from '../features/conversation/index.js';

export interface PresentConversationInput {
  readonly snapshot: ConversationSnapshot;
}

export function presentConversation(input: PresentConversationInput): readonly ClientConversationItem[] {
  return input.snapshot.items.map(item => presentConversationItem({ item }));
}

export interface PresentConversationItemInput {
  readonly item: ConversationItem;
}

export function presentConversationItem(input: PresentConversationItemInput): ClientConversationItem {
  const base = {
    id: input.item.id,
    lifecycle: input.item.lifecycle,
    placement: 'conversation' as const,
    body: createItemBody(input.item),
    actions: [],
    detail: createItemDetail(input.item),
  };

  switch (input.item.kind) {
    case 'message':
      return {
        ...base,
        kind: 'message',
        role: input.item.role ?? 'assistant',
      };

    case 'notice':
      return {
        ...base,
        kind: 'notice',
        level: 'info',
      };

    case 'reasoning':
    case 'plan':
    case 'command':
    case 'file-change':
    case 'tool-call':
    case 'review':
    case 'error':
      return {
        ...base,
        kind: input.item.kind,
      };
  }
}

function createItemBody(item: ConversationItem): ClientItemBody {
  if (item.title) {
    return {
      kind: 'structured',
      title: item.title,
      entries: [
        {
          label: 'content',
          value: item.text,
        },
      ],
    };
  }

  return {
    kind: 'text',
    text: item.text,
  };
}

function createItemDetail(item: ConversationItem): ClientItemDetail {
  if (!item.detailId || !item.detailRevision) {
    return {
      kind: 'none',
    };
  }

  return {
    kind: 'deferred',
    detailId: item.detailId,
    revision: item.detailRevision,
  };
}

export function isClientConversationItemKind(value: string): value is ConversationItemKind {
  return (
    value === 'message' ||
    value === 'reasoning' ||
    value === 'plan' ||
    value === 'command' ||
    value === 'file-change' ||
    value === 'tool-call' ||
    value === 'review' ||
    value === 'notice' ||
    value === 'error'
  );
}
