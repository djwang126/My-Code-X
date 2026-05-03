import type { ClientEvent, ClientEventScope } from '@my-code-x/contracts-new';
import type { EventBusPort, Unsubscribe } from '../ports/index.js';
import { isConversationDomainEvent, type ConversationService } from '../features/conversation/index.js';
import { presentConversation, presentConversationItem } from '../presenter/index.js';

export interface ClientEventStream {
  subscribe(input: SubscribeClientEventStreamInput): Unsubscribe;
}

export interface SubscribeClientEventStreamInput {
  readonly scope: ClientEventScope;
  send(event: ClientEvent): void;
}

export interface CreateClientEventStreamInput {
  readonly events: EventBusPort;
  readonly conversation: ConversationService;
}

export function createClientEventStream(input: CreateClientEventStreamInput): ClientEventStream {
  return {
    subscribe(subscription: SubscribeClientEventStreamInput): Unsubscribe {
      const unsubscribe = input.events.subscribe(event => {
        const clientEvent = presentStreamEvent({
          event,
          scope: subscription.scope,
        });

        if (!clientEvent) {
          return;
        }

        subscription.send(clientEvent);
      });
      subscription.send(createCurrentConversationReplacement({
        conversation: input.conversation,
        scope: subscription.scope,
      }));
      return unsubscribe;
    },
  };
}

interface CreateCurrentConversationReplacementInput {
  readonly conversation: ConversationService;
  readonly scope: ClientEventScope;
}

function createCurrentConversationReplacement(input: CreateCurrentConversationReplacementInput): ClientEvent {
  const snapshot = input.conversation.snapshot({ threadId: input.scope.threadId });

  return {
    kind: 'conversation-replaced',
    scope: input.scope,
    revision: String(snapshot.revision),
    conversation: {
      status: 'ready',
      revision: snapshot.revision,
      items: presentConversation({ snapshot }),
    },
  };
}

interface PresentStreamEventInput {
  readonly event: unknown;
  readonly scope: ClientEventScope;
}

function presentStreamEvent(input: PresentStreamEventInput): ClientEvent | null {
  if (!isConversationDomainEvent(input.event)) {
    return null;
  }

  if (input.event.threadId !== input.scope.threadId) {
    return null;
  }

  switch (input.event.kind) {
    case 'conversation-item-upserted':
      return {
        kind: 'conversation-item-upserted',
        scope: input.scope,
        revision: String(input.event.revision),
        item: presentConversationItem({ item: input.event.item }),
      };

    case 'conversation-replaced':
      return {
        kind: 'conversation-replaced',
        scope: input.scope,
        revision: String(input.event.revision),
        conversation: {
          status: 'ready',
          revision: input.event.revision,
          items: input.event.items.map(item => presentConversationItem({ item })),
        },
      };
  }
}
