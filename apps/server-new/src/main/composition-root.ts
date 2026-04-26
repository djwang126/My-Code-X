import { createCodexRuntime } from '../adapters/codex/index.js';
import { createEventBus } from '../adapters/memory/index.js';
import { createApplication } from '../application/index.js';
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

export function createAppComposition(): AppComposition {
  const config = loadConfig();
  const events = createEventBus();
  const runtime = createCodexRuntime({ options: config });
  const session = createSessionService({ runtime, events });
  const thread = createThreadService({ runtime, events });
  const chat = createChatService({ runtime, events });
  const workspace = createWorkspaceService();
  const appControl = createAppControlService();
  const application = createApplication({ appControl, chat, session, thread, workspace });
  const http = createHttpApp({ application });

  return {
    http,

    async close() {
      await session.close();
      await runtime.close();
    },
  };
}
