import type { ApplicationService } from '../../application/index.js';
import type { HttpHandler, HttpRequest, HttpResponse } from '../http-types.js';

export interface ChatControllerInput {
  application: ApplicationService;
}

export function createChatController(input: ChatControllerInput): HttpHandler {
  return {
    async handle(request: HttpRequest): Promise<HttpResponse> {
      return input.application.runChat(request);
    },
  };
}
