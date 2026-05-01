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
      if (request.path === '/client') {
        if (request.method !== 'POST') {
          return methodNotAllowed();
        }

        return routes.client.handle(request);
      }

      if (request.path === '/health') {
        if (request.method !== 'GET') {
          return methodNotAllowed();
        }

        return routes.health.handle(request);
      }

      return {
        statusCode: 404,
        message: 'Not found',
      };
    },
  };
}

function methodNotAllowed(): HttpResponse {
  return {
    statusCode: 405,
    message: 'Method not allowed',
  };
}
