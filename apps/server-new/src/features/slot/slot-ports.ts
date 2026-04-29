import type { EventBusPort } from '../../ports/index.js';

export interface SlotDependencies {
  readonly events: EventBusPort;
}
