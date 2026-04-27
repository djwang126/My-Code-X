import type { RuntimeErrorEvent, RuntimeInputRequestedEvent, RuntimeSystemNoticeEvent } from '../../ports/index.js';

export type SessionCommand = OpenSessionCommand;

export interface OpenSessionCommand {
  readonly kind: 'open-session';
  readonly sessionId: string;
}

export type SessionRuntimeEvent = RuntimeInputRequestedEvent | RuntimeErrorEvent | RuntimeSystemNoticeEvent;

export type SessionDomainEvent = SessionInputRequestedEvent | SessionRuntimeFailedEvent | SessionNoticeReceivedEvent;

export interface SessionInputRequestedEvent {
  readonly kind: 'session-input-requested';
  readonly requestId: string;
  readonly threadId: string | null;
  readonly prompt: string;
}

export interface SessionRuntimeFailedEvent {
  readonly kind: 'session-runtime-failed';
  readonly message: string;
}

export interface SessionNoticeReceivedEvent {
  readonly kind: 'session-notice-received';
  readonly message: string;
}

export interface SessionSnapshot {
  readonly sessionId: string | null;
  readonly pendingInputCount: number;
  readonly lastNotice: string | null;
  readonly lastError: string | null;
}
