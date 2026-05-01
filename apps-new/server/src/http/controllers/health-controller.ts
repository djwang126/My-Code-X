import { jsonResponse } from '../http-responses.js';
import type { HttpHandler, HttpRequest, HttpResponse } from '../http-types.js';

export function createHealthController(): HttpHandler {
  return {
    async handle(_input: HttpRequest): Promise<HttpResponse> {
      return jsonResponse({
        statusCode: 200,
        body: {
          status: 'ok',
        },
      });
    },
  };
}
