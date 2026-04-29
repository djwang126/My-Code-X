import type { Unsubscribe } from './runtime-port.js';

// DomainEvent is produced by feature code after it has interpreted commands or runtime events.
// It should describe server-domain meaning, not raw adapter payload.
export type DomainEvent = unknown;

export type DomainEventHandler = (event: DomainEvent) => void;

export interface EventBusPort {
  publish(event: DomainEvent): void;
  subscribe(handler: DomainEventHandler): Unsubscribe;
}
