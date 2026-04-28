import type { RuntimeRequest, RuntimeRequestDomainEvent, RuntimeRequestSnapshot } from './runtime-request-events.js';

export type RuntimeRequestState = RuntimeRequestSnapshot;

export function createInitialRuntimeRequestState(): RuntimeRequestState {
  return {
    requests: [],
  };
}

export interface ApplyRuntimeRequestDomainEventInput {
  readonly state: RuntimeRequestState;
  readonly event: RuntimeRequestDomainEvent;
}

export function applyRuntimeRequestDomainEvent(input: ApplyRuntimeRequestDomainEventInput): RuntimeRequestState {
  const { state, event } = input;

  switch (event.kind) {
    case 'runtime-request-opened':
      return {
        requests: upsertRequest(state.requests, event.request),
      };

    case 'runtime-request-submitting':
      return {
        requests: state.requests.map(request => request.id === event.requestId ? { ...request, lifecycle: 'submitting' } : request),
      };

    case 'runtime-request-resolved':
      return {
        requests: state.requests.filter(request => request.id !== event.requestId),
      };
  }
}

function upsertRequest(requests: readonly RuntimeRequest[], nextRequest: RuntimeRequest): readonly RuntimeRequest[] {
  const index = requests.findIndex(request => request.id === nextRequest.id);

  if (index === -1) {
    return [...requests, nextRequest];
  }

  return requests.map((request, requestIndex) => (requestIndex === index ? nextRequest : request));
}
