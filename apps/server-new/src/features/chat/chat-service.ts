import { createInitialChatState } from './chat-state.js';
import type { ChatCommand, ChatDomainEvent, ChatRuntimeEvent, ChatSnapshot } from './chat-events.js';
import type { ChatDependencies } from './chat-ports.js';
import type { ChatState } from './chat-state.js';

export interface ChatService {
  send(input: ChatCommand): Promise<ChatSnapshot>;
  receiveRuntimeEvent(event: ChatRuntimeEvent): void;
  snapshot(): ChatSnapshot;
}

function interpretChatRuntimeEvent(event: ChatRuntimeEvent): ChatDomainEvent {
  return event;
}

function applyChatDomainEvent(input: { state: ChatState; event: ChatDomainEvent }): ChatState {
  void input.state;
  return input.event;
}

export function createChatService(dependencies: ChatDependencies): ChatService {
  let state = createInitialChatState();

  return {
    async send(input: ChatCommand): Promise<ChatSnapshot> {
      await dependencies.runtime.send(input);
      return state;
    },

    receiveRuntimeEvent(event: ChatRuntimeEvent) {
      const domainEvent = interpretChatRuntimeEvent(event);
      state = applyChatDomainEvent({ state, event: domainEvent });
      dependencies.events.publish(domainEvent);
    },

    snapshot(): ChatSnapshot {
      return state;
    },
  };
}
