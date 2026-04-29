import type { EventBusPort, RuntimePort } from '../../ports/index.js';

export interface ThreadActionsDependencies {
  events: EventBusPort;
  runtime: RuntimePort;
}
