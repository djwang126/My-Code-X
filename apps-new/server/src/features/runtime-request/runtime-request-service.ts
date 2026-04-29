import { applyRuntimeRequestDomainEvent, createInitialRuntimeRequestState } from './runtime-request-state.js';
import type { RuntimeRequestCommand, RuntimeRequestDomainEvent, RuntimeRequestSnapshot } from './runtime-request-events.js';
import type { RuntimeRequestDependencies } from './runtime-request-ports.js';

export interface RuntimeRequestService {
  apply(input: RuntimeRequestCommand): RuntimeRequestSnapshot;
  snapshot(): RuntimeRequestSnapshot;
}

function createRuntimeRequestDomainEvent(command: RuntimeRequestCommand): RuntimeRequestDomainEvent {
  switch (command.kind) {
    case 'open-runtime-request':
      return {
        kind: 'runtime-request-opened',
        request: command.request,
      };

    case 'submit-runtime-request':
      return {
        kind: 'runtime-request-submitting',
        requestId: command.requestId,
      };

    case 'resolve-runtime-request':
      return {
        kind: 'runtime-request-resolved',
        requestId: command.requestId,
      };
  }
}

export function createRuntimeRequestService(dependencies: RuntimeRequestDependencies): RuntimeRequestService {
  let state = createInitialRuntimeRequestState();

  return {
    apply(input: RuntimeRequestCommand): RuntimeRequestSnapshot {
      const event = createRuntimeRequestDomainEvent(input);
      state = applyRuntimeRequestDomainEvent({ state, event });
      dependencies.events.publish(event);
      return state;
    },

    snapshot(): RuntimeRequestSnapshot {
      return state;
    },
  };
}
