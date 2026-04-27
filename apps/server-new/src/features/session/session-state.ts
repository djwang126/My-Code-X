import type { SessionDomainEvent, SessionSnapshot } from './session-events.js';

export type SessionState = SessionSnapshot;

export function createInitialSessionState(): SessionState {
  return {
    sessionId: null,
    pendingInputCount: 0,
    lastNotice: null,
    lastError: null,
  };
}

export function applySessionDomainEvent(input: ApplySessionDomainEventInput): SessionState {
  const { state, event } = input;

  switch (event.kind) {
    case 'session-input-requested':
      return {
        ...state,
        pendingInputCount: state.pendingInputCount + 1,
      };

    case 'session-runtime-failed':
      return {
        ...state,
        lastError: event.message,
      };

    case 'session-notice-received':
      return {
        ...state,
        lastNotice: event.message,
      };
  }
}

export interface ApplySessionDomainEventInput {
  readonly state: SessionState;
  readonly event: SessionDomainEvent;
}
