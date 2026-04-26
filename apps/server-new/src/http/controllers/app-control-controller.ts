import type { ApplicationService } from '../../application/index.js';
import type { HttpHandler, HttpRequest, HttpResponse } from '../http-types.js';

export interface AppControlControllerInput {
  application: ApplicationService;
}

export function createAppControlController(input: AppControlControllerInput): HttpHandler {
  return {
    async handle(request: HttpRequest): Promise<HttpResponse> {
      return input.application.runAppControl(request);
    },
  };
}
