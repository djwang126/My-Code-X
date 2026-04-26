import type { EventBusPort, RuntimePort } from '../../ports/index.js';

export interface ChatDependencies {
  events: EventBusPort;
  runtime: RuntimePort;
}