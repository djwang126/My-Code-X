import { readBodyObject, readRequiredKind, readRequiredString } from '../http-body.js';
import type { ApplicationService, ApplicationSessionCommand } from '../../application/index.js';
import type { HttpHandler, HttpRequest, HttpResponse } from '../http-types.js';

export interface SessionControllerInput {
  application: ApplicationService;
}

export function createSessionController(input: SessionControllerInput): HttpHandler {
  return {
    async handle(request: HttpRequest): Promise<HttpResponse> {
      return input.application.runSession(readSessionCommand(request));
    },
  };
}

function readSessionCommand(request: HttpRequest): ApplicationSessionCommand {
  const body = readBodyObject(request);
  const kind = readRequiredKind(body, ['open-session']);

  return {
    kind,
    sessionId: readRequiredString(body, 'sessionId'),
  };
}
