import { createAppControlController } from './controllers/app-control-controller.js';
import { createChatController } from './controllers/chat-controller.js';
import { createHealthController } from './controllers/health-controller.js';
import { createSessionController } from './controllers/session-controller.js';
import { createThreadController } from './controllers/thread-controller.js';
import { createWorkspaceController } from './controllers/workspace-controller.js';
import type { ApplicationService } from '../application/index.js';
import type { HttpHandler } from './http-types.js';

export interface RouteTableInput {
  application: ApplicationService;
}

export interface RouteTable {
  appControl: HttpHandler;
  chat: HttpHandler;
  health: HttpHandler;
  session: HttpHandler;
  thread: HttpHandler;
  workspace: HttpHandler;
}

export function createRouteTable(input: RouteTableInput): RouteTable {
  return {
    appControl: createAppControlController({ application: input.application }),
    chat: createChatController({ application: input.application }),
    health: createHealthController(),
    session: createSessionController({ application: input.application }),
    thread: createThreadController({ application: input.application }),
    workspace: createWorkspaceController({ application: input.application }),
  };
}
