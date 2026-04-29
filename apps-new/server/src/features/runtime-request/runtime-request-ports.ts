import type { EventBusPort } from '../../ports/index.js';

export interface RuntimeRequestDependencies {
  readonly events: EventBusPort;
}
