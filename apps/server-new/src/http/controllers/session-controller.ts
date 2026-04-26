import type { ApplicationService } from '../../application/index.js';
import type { HttpHandler, HttpRequest, HttpResponse } from '../http-types.js';

export interface SessionControllerInput {
  application: ApplicationService;
}

export function createSessionController(input: SessionControllerInput): HttpHandler {
  return {
    async handle(request: HttpRequest): Promise<HttpResponse> {
      return input.application.runSession(request);
    },
  };
}
