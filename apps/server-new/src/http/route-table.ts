import { createClientController } from './controllers/client-controller.js';
import { createHealthController } from './controllers/health-controller.js';
import type { ApplicationService } from '../application/index.js';
import type { HttpHandler } from './http-types.js';

export interface RouteTableInput {
  application: ApplicationService;
}

export interface RouteTable {
  client: HttpHandler;
  health: HttpHandler;
}

export function createRouteTable(input: RouteTableInput): RouteTable {
  return {
    client: createClientController({ application: input.application }),
    health: createHealthController(),
  };
}
