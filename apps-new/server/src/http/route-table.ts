import { createClientController } from './controllers/client-controller.js';
import { createClientEventsController } from './controllers/client-events-controller.js';
import { createHealthController } from './controllers/health-controller.js';
import type { ApplicationService, ClientEventStream } from '../application/index.js';
import type { HttpHandler } from './http-types.js';

export interface RouteTableInput {
  readonly application: ApplicationService;
  readonly eventStream: ClientEventStream;
}

export interface RouteTable {
  readonly client: HttpHandler;
  readonly clientEvents: HttpHandler;
  readonly health: HttpHandler;
}

export function createRouteTable(input: RouteTableInput): RouteTable {
  return {
    client: createClientController({ application: input.application }),
    clientEvents: createClientEventsController({ eventStream: input.eventStream }),
    health: createHealthController(),
  };
}
