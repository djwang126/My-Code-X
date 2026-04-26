import type { ApplicationService } from '../../application/index.js';
import type { HttpHandler, HttpRequest, HttpResponse } from '../http-types.js';

export interface ThreadControllerInput {
  application: ApplicationService;
}

export function createThreadController(input: ThreadControllerInput): HttpHandler {
  return {
    async handle(request: HttpRequest): Promise<HttpResponse> {
      return input.application.runThread(request);
    },
  };
}
