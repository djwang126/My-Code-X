import type { ApplicationService } from '../../application/index.js';
import type { HttpHandler, HttpRequest, HttpResponse } from '../http-types.js';

export interface WorkspaceControllerInput {
  application: ApplicationService;
}

export function createWorkspaceController(input: WorkspaceControllerInput): HttpHandler {
  return {
    async handle(request: HttpRequest): Promise<HttpResponse> {
      return input.application.runWorkspace(request);
    },
  };
}
