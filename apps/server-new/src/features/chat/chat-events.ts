import type {
  RuntimeErrorInfo,
  RuntimeInputRequestedEvent,
  RuntimeOutputUpdatedEvent,
  RuntimeSettings,
  RuntimeTurnCompletedEvent,
  RuntimeTurnStartedEvent,
} from '../../ports/index.js';

export type ChatCommand = SendChatMessageCommand | InterruptChatCommand;

export interface SendChatMessageCommand {
  readonly kind: 'send-chat-message';
  readonly threadId: string;
  readonly message: string;
  readonly runtimeSettings: RuntimeSettings | null;
}

export interface InterruptChatCommand {
  readonly kind: 'interrupt-chat';
  readonly threadId: string;
  readonly turnId: string | null;
}

export type ChatRuntimeEvent =
  | RuntimeInputRequestedEvent
  | RuntimeTurnStartedEvent
  | RuntimeOutputUpdatedEvent
  | RuntimeTurnCompletedEvent;

export type ChatDomainEvent =
  | ChatTurnStartedEvent
  | ChatOutputUpdatedEvent
  | ChatTurnCompletedEvent
  | ChatInputRequestedEvent;

export interface ChatTurnStartedEvent {
  readonly kind: 'chat-turn-started';
  readonly threadId: string;
  readonly turnId: string;
}

export interface ChatOutputUpdatedEvent {
  readonly kind: 'chat-output-updated';
  readonly threadId: string;
  readonly turnId: string | null;
  readonly itemId: string;
  readonly text: string | null;
}

export interface ChatTurnCompletedEvent {
  readonly kind: 'chat-turn-completed';
  readonly threadId: string;
  readonly turnId: string;
  readonly status: 'completed' | 'interrupted' | 'failed';
  readonly error: RuntimeErrorInfo | null;
}

export interface ChatInputRequestedEvent {
  readonly kind: 'chat-input-requested';
  readonly requestId: string;
  readonly threadId: string | null;
  readonly prompt: string;
}

export interface ChatSnapshot {
  readonly threadId: string | null;
  readonly activeTurnId: string | null;
  readonly status: 'idle' | 'running' | 'waiting-for-input' | 'failed';
  readonly latestText: string;
  readonly lastError: RuntimeErrorInfo | null;
}
