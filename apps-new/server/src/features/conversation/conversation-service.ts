import { applyConversationDomainEvent, createInitialConversationState } from './conversation-state.js';
import type { ConversationCommand, ConversationDomainEvent, ConversationSnapshot } from './conversation-events.js';
import type { ConversationDependencies } from './conversation-ports.js';

export interface ConversationService {
  apply(input: ConversationCommand): ConversationSnapshot;
  snapshot(): ConversationSnapshot;
}

function createConversationDomainEvent(command: ConversationCommand): ConversationDomainEvent {
  switch (command.kind) {
    case 'replace-conversation':
      return {
        kind: 'conversation-replaced',
        items: command.items,
      };

    case 'upsert-conversation-item':
      return {
        kind: 'conversation-item-upserted',
        item: command.item,
      };
  }
}

export function createConversationService(dependencies: ConversationDependencies): ConversationService {
  let state = createInitialConversationState();

  return {
    apply(input: ConversationCommand): ConversationSnapshot {
      const event = createConversationDomainEvent(input);
      state = applyConversationDomainEvent({ state, event });
      dependencies.events.publish(event);
      return state;
    },

    snapshot(): ConversationSnapshot {
      return state;
    },
  };
}
