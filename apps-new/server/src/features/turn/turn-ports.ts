import type { EventBusPort } from '../../ports/index.js';

export interface TurnDependencies {
  readonly events: EventBusPort;
}
