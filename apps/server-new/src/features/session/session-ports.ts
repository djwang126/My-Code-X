import type { EventBusPort, RuntimePort } from '../../ports/index.js';

export interface SessionDependencies {
  events: EventBusPort;
  runtime: RuntimePort;
}