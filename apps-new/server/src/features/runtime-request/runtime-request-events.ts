import type { JsonValue } from '../../shared/index.js';

export type RuntimeRequestCommand = OpenRuntimeRequestCommand | SubmitRuntimeRequestCommand | ResolveRuntimeRequestCommand;

export interface OpenRuntimeRequestCommand {
  readonly kind: 'open-runtime-request';
  readonly request: RuntimeRequest;
}

export interface SubmitRuntimeRequestCommand {
  readonly kind: 'submit-runtime-request';
  readonly requestId: string;
}

export interface ResolveRuntimeRequestCommand {
  readonly kind: 'resolve-runtime-request';
  readonly requestId: string;
}

export type RuntimeRequestDomainEvent = RuntimeRequestOpenedEvent | RuntimeRequestSubmittingEvent | RuntimeRequestResolvedEvent;

export interface RuntimeRequestOpenedEvent {
  readonly kind: 'runtime-request-opened';
  readonly request: RuntimeRequest;
}

export interface RuntimeRequestSubmittingEvent {
  readonly kind: 'runtime-request-submitting';
  readonly requestId: string;
}

export interface RuntimeRequestResolvedEvent {
  readonly kind: 'runtime-request-resolved';
  readonly requestId: string;
}

export interface RuntimeRequestSnapshot {
  readonly requests: readonly RuntimeRequest[];
}

export type RuntimeRequestKind = 'approval' | 'form' | 'auth' | 'tool-response';

export type RuntimeRequestLifecycle = 'open' | 'submitting' | 'resolved' | 'expired';

export interface RuntimeRequest {
  readonly id: string;
  readonly kind: RuntimeRequestKind;
  readonly lifecycle: RuntimeRequestLifecycle;
  readonly title: string;
  readonly prompt: string;
  readonly responseKind: 'decision' | 'form' | 'freeform' | 'structured';
  readonly data: JsonValue;
}
