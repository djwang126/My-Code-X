import { applySessionDomainEvent, createInitialSessionState } from './session-state.js';
import type { SessionCommand, SessionDomainEvent, SessionRuntimeEvent, SessionSnapshot } from './session-events.js';
import type { SessionDependencies } from './session-ports.js';

export interface SessionService {
  open(input: SessionCommand): Promise<SessionSnapshot>;
  receiveRuntimeEvent(event: SessionRuntimeEvent): void;
  snapshot(): SessionSnapshot;
  close(): Promise<void>;
}

function interpretSessionRuntimeEvent(event: SessionRuntimeEvent): SessionDomainEvent {
  switch (event.kind) {
    case 'runtime-input-requested':
      return {
        kind: 'session-input-requested',
        requestId: event.requestId,
        threadId: event.threadId,
        prompt: event.prompt,
      };

    case 'runtime-error':
      return {
        kind: 'session-runtime-failed',
        message: event.error.message,
      };

    case 'runtime-system-notice':
      return {
        kind: 'session-notice-received',
        message: event.message,
      };
  }
}

export function createSessionService(dependencies: SessionDependencies): SessionService {
  let state = createInitialSessionState();

  return {
    async open(input: SessionCommand): Promise<SessionSnapshot> {
      state = { ...state, sessionId: input.sessionId };
      return state;
    },

    receiveRuntimeEvent(event: SessionRuntimeEvent) {
      const domainEvent = interpretSessionRuntimeEvent(event);
      state = applySessionDomainEvent({ state, event: domainEvent });
      dependencies.events.publish(domainEvent);
    },

    snapshot(): SessionSnapshot {
      return state;
    },

    async close() {},
  };
}
