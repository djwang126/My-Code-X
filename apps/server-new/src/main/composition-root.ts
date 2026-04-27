import { createCodexRuntime } from '../adapters/codex/index.js';
import { createEventBus } from '../adapters/memory/index.js';
import { createApplication, createRuntimeEventCoordinator } from '../application/index.js';
import { loadConfig } from '../config/index.js';
import { createAppControlService } from '../features/app-control/index.js';
import { createChatService } from '../features/chat/index.js';
import { createSessionService } from '../features/session/index.js';
import { createThreadService } from '../features/thread/index.js';
import { createWorkspaceService } from '../features/workspace/index.js';
import { createHttpApp } from '../http/index.js';
import type { HttpHandler } from '../http/index.js';

export interface AppComposition {
  http: HttpHandler;
  close(): Promise<void>;
}

export async function createAppComposition(): Promise<AppComposition> {
  const config = loadConfig();
  const events = createEventBus();
  const runtime = await createCodexRuntime({ options: config.codex });
  const session = createSessionService({ events });
  const thread = createThreadService({ runtime, events });
  const chat = createChatService({ runtime, events });
  const workspace = createWorkspaceService();
  const appControl = createAppControlService();
  const application = createApplication({ appControl, chat, session, thread, workspace });
  const runtimeEvents = createRuntimeEventCoordinator({ chat, session, thread });
  const unsubscribeRuntimeEvents = runtime.subscribe(runtimeEvents.receive);
  const http = createHttpApp({ application });

  return {
    http,

    async close() {
      unsubscribeRuntimeEvents();
      await session.close();
      await runtime.close();
    },
  };
}
