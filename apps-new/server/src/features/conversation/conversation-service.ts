import { applyConversationDomainEvent, createInitialConversationState } from './conversation-state.js';
import { projectRuntimeThreadItem } from './conversation-runtime-projection.js';
import type { ConversationCommand, ConversationDomainEvent, ConversationSnapshot } from './conversation-events.js';
import type { ConversationDependencies } from './conversation-ports.js';

export interface ConversationService {
  apply(input: ConversationCommand): ConversationSnapshot;
  snapshot(): ConversationSnapshot;
}

function createConversationDomainEvent(command: ConversationCommand): ConversationDomainEvent | null {
  switch (command.kind) {
    case 'replace-conversation':
      return {
        kind: 'conversation-replaced',
        items: command.items,
      };

    case 'append-conversation-item':
      return {
        kind: 'conversation-item-appended',
        item: command.item,
      };

    case 'record-runtime-thread-item': {
      const item = projectRuntimeThreadItem({ item: command.item });

      if (!item) {
        return null;
      }

      return {
        kind: 'conversation-item-upserted',
        item,
      };
    }
  }
}

export function createConversationService(dependencies: ConversationDependencies): ConversationService {
  let state = createInitialConversationState();

  return {
    apply(input: ConversationCommand): ConversationSnapshot {
      const event = createConversationDomainEvent(input);

      if (!event) {
        return state;
      }

      const nextState = applyConversationDomainEvent({ state, event });

      if (nextState === state) {
        return state;
      }

      state = nextState;
      dependencies.events.publish(event);
      return state;
    },

    snapshot(): ConversationSnapshot {
      return state;
    },
  };
}
