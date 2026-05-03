import type {
  ClientConversationItem,
  ClientConversationReadyView,
  ClientConversationView,
  ClientEvent,
  ClientEventScope,
} from '@my-code-x/contracts-new';

export interface ApplyConversationClientEventInput {
  readonly scope: ClientEventScope;
  readonly conversation: ClientConversationView;
  readonly event: ClientEvent;
}

export function applyConversationClientEvent(input: ApplyConversationClientEventInput): ClientConversationView {
  if (!isMatchingScope({ current: input.scope, event: input.event.scope })) {
    return input.conversation;
  }

  switch (input.event.kind) {
    case 'conversation-replaced':
      return replaceConversationFromEvent({
        conversation: input.conversation,
        revision: input.event.revision,
        replacement: input.event.conversation,
      });

    case 'conversation-item-upserted':
      return upsertConversationItemFromEvent({
        conversation: input.conversation,
        revision: input.event.revision,
        item: input.event.item,
      });

    case 'snapshot':
    case 'turn-changed':
    case 'thread-changed':
    case 'pending-interaction-opened':
    case 'pending-interaction-closed':
    case 'notice-added':
    case 'error-raised':
      return input.conversation;
  }
}

interface IsMatchingScopeInput {
  readonly current: ClientEventScope;
  readonly event: ClientEventScope;
}

function isMatchingScope(input: IsMatchingScopeInput): boolean {
  return input.current.slotId === input.event.slotId && input.current.threadId === input.event.threadId;
}

interface UpsertConversationItemInput {
  readonly conversation: ClientConversationView;
  readonly revision: number;
  readonly item: ClientConversationItem;
}

interface UpsertConversationItemFromEventInput {
  readonly conversation: ClientConversationView;
  readonly revision: string;
  readonly item: ClientConversationItem;
}

interface ReplaceConversationFromEventInput {
  readonly conversation: ClientConversationView;
  readonly revision: string;
  readonly replacement: ClientConversationView;
}

function replaceConversationFromEvent(input: ReplaceConversationFromEventInput): ClientConversationView {
  const revision = readConversationRevision(input.revision);

  if (revision === null || !shouldApplyConversationRevision({
    conversation: input.conversation,
    revision,
  })) {
    return input.conversation;
  }

  return input.replacement;
}

function upsertConversationItemFromEvent(input: UpsertConversationItemFromEventInput): ClientConversationView {
  const revision = readConversationRevision(input.revision);

  if (revision === null || !shouldApplyConversationRevision({
    conversation: input.conversation,
    revision,
  })) {
    return input.conversation;
  }

  return upsertConversationItem({
    conversation: input.conversation,
    revision,
    item: input.item,
  });
}

interface ShouldApplyConversationRevisionInput {
  readonly conversation: ClientConversationView;
  readonly revision: number;
}

function shouldApplyConversationRevision(input: ShouldApplyConversationRevisionInput): boolean {
  if (input.conversation.status !== 'ready') {
    return true;
  }

  return input.revision > input.conversation.revision;
}

function upsertConversationItem(input: UpsertConversationItemInput): ClientConversationView {
  if (input.conversation.status !== 'ready') {
    return input.conversation;
  }

  const itemIndex = input.conversation.items.findIndex(item => item.id === input.item.id);

  if (itemIndex < 0) {
    return createReadyConversation({
      revision: input.revision,
      items: [...input.conversation.items, input.item],
    });
  }

  return createReadyConversation({
    revision: input.revision,
    items: input.conversation.items.map((item, index) => (index === itemIndex ? input.item : item)),
  });
}

interface CreateReadyConversationInput {
  readonly revision: number;
  readonly items: readonly ClientConversationItem[];
}

function createReadyConversation(input: CreateReadyConversationInput): ClientConversationReadyView {
  return {
    status: 'ready',
    revision: input.revision,
    items: input.items,
  };
}

function readConversationRevision(revision: string): number | null {
  const parsed = Number(revision);

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}
