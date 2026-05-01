import { clientActionSchema, type ClientAction } from '@my-code-x/contracts-new';
import type { ApplicationService } from '../../application/index.js';
import type { HttpHandler, HttpRequest, HttpResponse } from '../http-types.js';

export interface ClientControllerInput {
  application: ApplicationService;
}

export function createClientController(input: ClientControllerInput): HttpHandler {
  return {
    async handle(request: HttpRequest): Promise<HttpResponse> {
      const actionResult = readClientAction(request);

      if (actionResult.status === 'invalid') {
        return {
          statusCode: 400,
          message: 'Invalid client action',
        };
      }

      const action = actionResult.action;

      switch (action.kind) {
        case 'open-client':
          return input.application.openClient(action);

        case 'send-message':
          return input.application.sendClientMessage(action);

        case 'resume-thread':
          return input.application.resumeClientThread(action);

        case 'respond-interaction':
          return input.application.respondClientInteraction(action);

        case 'interrupt-turn':
          return input.application.interruptClientTurn(action);
      }
    },
  };
}

type ReadClientActionResult =
  | { readonly status: 'valid'; readonly action: ClientAction }
  | { readonly status: 'invalid' };

function readClientAction(request: HttpRequest): ReadClientActionResult {
  const parsed = clientActionSchema.safeParse(request.body);

  if (!parsed.success) {
    return {
      status: 'invalid',
    };
  }

  return {
    status: 'valid',
    action: parsed.data,
  };
}
