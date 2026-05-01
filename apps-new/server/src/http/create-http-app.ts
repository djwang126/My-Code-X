import { createRouteTable } from './route-table.js';
import type { ApplicationService } from '../application/index.js';
import type { HttpHandler, HttpRequest, HttpResponse } from './http-types.js';
import { createHttpErrorResponse } from './http-error-response.js';
import { classifyHttpRoute } from './http-route-policy.js';
import { errorResponse } from './http-responses.js';

export interface HttpAppInput {
  application: ApplicationService;
}

export function createHttpApp(input: HttpAppInput): HttpHandler {
  const routes = createRouteTable(input);

  return {
    async handle(request: HttpRequest): Promise<HttpResponse> {
      try {
        const routeKind = classifyHttpRoute({ path: request.path });

        if (routeKind === 'client') {
          if (request.method !== 'POST') {
            return methodNotAllowed();
          }

          if (!isJsonContentType(request)) {
            return errorResponse({
              statusCode: 415,
              body: 'Unsupported media type',
            });
          }

          return routes.client.handle(request);
        }

        if (routeKind === 'health') {
          if (request.method !== 'GET') {
            return methodNotAllowed();
          }

          return routes.health.handle(request);
        }

        return errorResponse({
          statusCode: 404,
          body: 'Not found',
        });
      } catch (error) {
        return createHttpErrorResponse(error);
      }
    },
  };
}

function methodNotAllowed(): HttpResponse {
  return errorResponse({
    statusCode: 405,
    body: 'Method not allowed',
  });
}

function isJsonContentType(request: HttpRequest): boolean {
  const contentType = request.headers['content-type'] ?? '';
  return contentType.toLowerCase().split(';')[0]?.trim() === 'application/json';
}
