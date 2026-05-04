import os from 'node:os';
import { createCodexRuntime } from '../adapters/codex/index.js';
import { createEventBus } from '../adapters/memory/index.js';
import { createNodeAppDataStore, createNodePathComparison, createNodePathInspection, createRandomId, createSystemClock } from '../adapters/node/index.js';
import { createApplication, createClientEventStream, createRuntimeEventCoordinator } from '../application/index.js';
import { loadConfig } from '../config/index.js';
import type { HttpServerConfig } from '../config/index.js';
import { createConversationService } from '../features/conversation/index.js';
import { createSlotService } from '../features/slot/index.js';
import { createThreadActionsService } from '../features/thread-actions/index.js';
import { createThreadService } from '../features/thread/index.js';
import { createTurnService } from '../features/turn/index.js';
import { createWorkspaceService } from '../features/workspace/index.js';
import { createHttpApp } from '../http/index.js';
import type { HttpHandler } from '../http/index.js';

export interface AppComposition {
  http: HttpHandler;
  httpServer: HttpServerConfig;
  close(): Promise<void>;
}

export async function createAppComposition(): Promise<AppComposition> {
  const config = loadConfig();
  const events = createEventBus();
  const runtime = await createCodexRuntime({ options: config.codex });
  const slot = createSlotService({ events });
  const thread = createThreadService({ events });
  const threadActions = createThreadActionsService({ runtime, events });
  const conversation = createConversationService({ events });
  const turn = createTurnService({ events });
  const workspace = createWorkspaceService({
    appData: createNodeAppDataStore({ homeDirectory: os.homedir() }),
    paths: createNodePathInspection(),
    pathComparison: createNodePathComparison({ platform: process.platform }),
    clock: createSystemClock(),
    ids: createRandomId(),
  });
  const application = createApplication({ conversation, runtime, slot, thread, threadActions, turn, workspace });
  const eventStream = createClientEventStream({ conversation, events });
  const runtimeEvents = createRuntimeEventCoordinator({ conversation, thread, turn });
  const unsubscribeRuntimeEvents = runtime.subscribe(runtimeEvents.receive);
  const http = createHttpApp({ application, eventStream });


  return {
    http,
    httpServer: config.httpServer,

    async close() {
      unsubscribeRuntimeEvents();
      await runtime.close();
    },
  };
}
