import { applyChatDomainEvent, createInitialChatState } from './chat-state.js';
import type { ChatCommand, ChatDomainEvent, ChatRuntimeEvent, ChatSnapshot } from './chat-events.js';
import type { ChatDependencies } from './chat-ports.js';
import type { RuntimeCommand } from '../../ports/index.js';

export interface ChatService {
  send(input: ChatCommand): Promise<ChatSnapshot>;
  receiveRuntimeEvent(event: ChatRuntimeEvent): void;
  snapshot(): ChatSnapshot;
}

function toRuntimeCommand(command: ChatCommand): RuntimeCommand {
  switch (command.kind) {
    case 'send-chat-message':
      return {
        kind: 'start-turn',
        threadId: command.threadId,
        message: command.message,
        content: [{ kind: 'text', text: command.message }],
        runtimeSettings: command.runtimeSettings,
      };

    case 'interrupt-chat':
      return {
        kind: 'interrupt-turn',
        threadId: command.threadId,
        turnId: command.turnId,
      };
  }
}

function interpretChatRuntimeEvent(event: ChatRuntimeEvent): ChatDomainEvent {
  switch (event.kind) {
    case 'runtime-turn-started':
      return {
        kind: 'chat-turn-started',
        threadId: event.threadId,
        turnId: event.turnId,
      };

    case 'runtime-output-updated':
      return {
        kind: 'chat-output-updated',
        threadId: event.threadId,
        turnId: event.turnId,
        itemId: event.itemId,
        text: event.text,
      };

    case 'runtime-turn-completed':
      return {
        kind: 'chat-turn-completed',
        threadId: event.threadId,
        turnId: event.turnId,
        status: event.status,
        error: event.error,
      };

    case 'runtime-input-requested':
      return {
        kind: 'chat-input-requested',
        requestId: event.requestId,
        threadId: event.threadId,
        prompt: event.prompt,
      };
  }
}

export function createChatService(dependencies: ChatDependencies): ChatService {
  let state = createInitialChatState();

  return {
    async send(input: ChatCommand): Promise<ChatSnapshot> {
      await dependencies.runtime.send(toRuntimeCommand(input));
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
