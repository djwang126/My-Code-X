import { clientActionSchema, type ClientAction } from '@my-code-x/contracts-new';
import type { ApplicationService } from '../../application/index.js';
import { errorResponse, jsonResponse } from '../http-responses.js';
import type { HttpHandler, HttpRequest, HttpResponse } from '../http-types.js';

export interface ClientControllerInput {
  application: ApplicationService;
}

export function createClientController(input: ClientControllerInput): HttpHandler {
  return {
    async handle(request: HttpRequest): Promise<HttpResponse> {
      const actionResult = readClientAction(request);

      if (actionResult.status === 'invalid') {
        return errorResponse({
          statusCode: 400,
          body: 'Invalid client action',
        });
      }

      const action = actionResult.action;

      switch (action.kind) {
        case 'open-client':
          return jsonResponse({
            statusCode: 200,
            body: await input.application.openClient(action),
          });

        case 'send-message':
          return jsonResponse({
            statusCode: 200,
            body: await input.application.sendClientMessage(action),
          });

        case 'resume-thread':
          return jsonResponse({
            statusCode: 200,
            body: await input.application.resumeClientThread(action),
          });

        case 'respond-interaction':
          return jsonResponse({
            statusCode: 200,
            body: await input.application.respondClientInteraction(action),
          });

        case 'interrupt-turn':
          return jsonResponse({
            statusCode: 200,
            body: await input.application.interruptClientTurn(action),
          });
      }
    },
  };
}

type ReadClientActionResult =
  | { readonly status: 'valid'; readonly action: ClientAction }
  | { readonly status: 'invalid' };

function readClientAction(request: HttpRequest): ReadClientActionResult {
  if (typeof request.body === 'string' || request.body === null) {
    return {
      status: 'invalid',
    };
  }

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
