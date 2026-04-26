import { createRouteTable } from './route-table.js';
import type { ApplicationService } from '../application/index.js';
import type { HttpHandler, HttpRequest, HttpResponse } from './http-types.js';

export interface HttpAppInput {
  application: ApplicationService;
}

export function createHttpApp(input: HttpAppInput): HttpHandler {
  const routes = createRouteTable(input);

  return {
    async handle(request: HttpRequest): Promise<HttpResponse> {
      return routes.health.handle(request);
    },
  };
}
