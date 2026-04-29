import type { EventBusPort } from '../../ports/index.js';

export interface ThreadDependencies {
  readonly events: EventBusPort;
}
