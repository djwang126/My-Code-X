import type { EventBusPort, RuntimePort } from '../../ports/index.js';

export interface ThreadDependencies {
  events: EventBusPort;
  runtime: RuntimePort;
}