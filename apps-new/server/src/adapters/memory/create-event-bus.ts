import type { DomainEvent, DomainEventHandler, EventBusPort, Unsubscribe } from '../../ports/index.js';

export function createEventBus(): EventBusPort {
  const handlers = new Set<DomainEventHandler>();

  return {
    publish(event: DomainEvent) {
      for (const handler of handlers) {
        handler(event);
      }
    },

    subscribe(handler: DomainEventHandler): Unsubscribe {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
  };
}
