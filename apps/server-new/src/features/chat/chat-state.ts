import type { ChatDomainEvent, ChatSnapshot } from './chat-events.js';

export type ChatState = ChatSnapshot;

export function createInitialChatState(): ChatState {
  return {
    threadId: null,
    activeTurnId: null,
    status: 'idle',
    latestText: '',
    lastError: null,
  };
}

export function applyChatDomainEvent(input: ApplyChatDomainEventInput): ChatState {
  const { state, event } = input;

  switch (event.kind) {
    case 'chat-turn-started':
      return {
        ...state,
        threadId: event.threadId,
        activeTurnId: event.turnId,
        status: 'running',
        lastError: null,
      };

    case 'chat-output-updated':
      return {
        ...state,
        threadId: event.threadId,
        latestText: event.text === null ? state.latestText : `${state.latestText}${event.text}`,
      };

    case 'chat-turn-completed':
      return {
        ...state,
        threadId: event.threadId,
        activeTurnId: null,
        status: event.status === 'failed' ? 'failed' : 'idle',
        lastError: event.error,
      };

    case 'chat-input-requested':
      return {
        ...state,
        threadId: event.threadId ?? state.threadId,
        status: 'waiting-for-input',
      };
  }
}

export interface ApplyChatDomainEventInput {
  readonly state: ChatState;
  readonly event: ChatDomainEvent;
}
