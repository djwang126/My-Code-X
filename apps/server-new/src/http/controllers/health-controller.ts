import type { HttpHandler, HttpRequest, HttpResponse } from '../http-types.js';

export function createHealthController(): HttpHandler {
  return {
    async handle(input: HttpRequest): Promise<HttpResponse> {
      return input;
    },
  };
}