import { readBodyObject, readOptionalObject, readOptionalString, readRequiredKind } from '../http-body.js';
import type { ClientAction, ClientActionKind, ClientActionScope } from '../../contracts/index.js';
import type { ApplicationService } from '../../application/index.js';
import type { JsonObject } from '../../shared/index.js';
import type { HttpHandler, HttpRequest, HttpResponse } from '../http-types.js';

const clientActionKinds: readonly ClientActionKind[] = [
  'open-client',
  'send-message',
  'resume-thread',
  'respond-interaction',
  'interrupt-turn',
];

export interface ClientControllerInput {
  application: ApplicationService;
}

export function createClientController(input: ClientControllerInput): HttpHandler {
  return {
    async handle(request: HttpRequest): Promise<HttpResponse> {
      const action = readClientAction(request);

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

function readClientAction(request: HttpRequest): ClientAction {
  const body = readBodyObject(request);
  const kind = readRequiredKind(body, clientActionKinds);
  const scope = readClientActionScope(body);
  const payload = readOptionalObject(body, 'payload') ?? {};

  return createClientAction({ kind, scope, payload });
}

interface CreateClientActionInput {
  readonly kind: ClientActionKind;
  readonly scope: ClientActionScope;
  readonly payload: JsonObject;
}

function createClientAction(input: CreateClientActionInput): ClientAction {
  switch (input.kind) {
    case 'open-client':
      return { ...input, kind: 'open-client' };
    case 'send-message':
      return { ...input, kind: 'send-message' };
    case 'resume-thread':
      return { ...input, kind: 'resume-thread' };
    case 'respond-interaction':
      return { ...input, kind: 'respond-interaction' };
    case 'interrupt-turn':
      return { ...input, kind: 'interrupt-turn' };
  }
}

function readClientActionScope(body: JsonObject): ClientActionScope {
  const scope = readOptionalObject(body, 'scope') ?? {};

  return {
    slotId: readOptionalString(scope, 'slotId'),
    workspaceId: readOptionalString(scope, 'workspaceId'),
    threadId: readOptionalString(scope, 'threadId'),
  };
}
