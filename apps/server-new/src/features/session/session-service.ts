import { createInitialSessionState } from './session-state.js';
import type { SessionCommand, SessionDomainEvent, SessionRuntimeEvent, SessionSnapshot } from './session-events.js';
import type { SessionDependencies } from './session-ports.js';
import type { SessionState } from './session-state.js';

export interface SessionService {
  open(input: SessionCommand): Promise<SessionSnapshot>;
  receiveRuntimeEvent(event: SessionRuntimeEvent): void;
  snapshot(): SessionSnapshot;
  close(): Promise<void>;
}

function interpretSessionRuntimeEvent(event: SessionRuntimeEvent): SessionDomainEvent {
  return event;
}

function applySessionDomainEvent(input: { state: SessionState; event: SessionDomainEvent }): SessionState {
  void input.state;
  return input.event;
}

export function createSessionService(dependencies: SessionDependencies): SessionService {
  let state = createInitialSessionState();

  return {
    async open(input: SessionCommand): Promise<SessionSnapshot> {
      await dependencies.runtime.send(input);
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
