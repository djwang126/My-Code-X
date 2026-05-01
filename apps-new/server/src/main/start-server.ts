import { createAppComposition } from './composition-root.js';
import type { AppComposition } from './composition-root.js';
import { registerShutdown } from './shutdown.js';
import type { HttpServerConfig } from '../config/index.js';
import { startNodeHttpServer } from '../http/node/index.js';
import type { NodeHttpServerOptions, StartedNodeHttpServer, StartNodeHttpServerInput } from '../http/node/index.js';

export interface StartedServer {
  close(): Promise<void>;
}

export async function startServer(): Promise<StartedServer> {
  return startServerWithDependencies({
    createAppComposition,
    registerShutdown,
    startNodeHttpServer,
  });
}

export interface StartServerDependencies {
  createAppComposition(): Promise<AppComposition>;
  registerShutdown(target: StartedServer): void;
  startNodeHttpServer(input: StartNodeHttpServerInput): Promise<StartedNodeHttpServer>;
}

export async function startServerWithDependencies(dependencies: StartServerDependencies): Promise<StartedServer> {
  const composition = await dependencies.createAppComposition();
  let httpServer: StartedNodeHttpServer;

  try {
    httpServer = await dependencies.startNodeHttpServer({
      handler: composition.http,
      options: createNodeHttpServerOptions(composition.httpServer),
    });
  } catch (error) {
    await closeAfterStartFailure({ composition });
    throw error;
  }

  const startedServer: StartedServer = {
    async close() {
      await closeStartedServer({ composition, httpServer });
    },
  };

  dependencies.registerShutdown(startedServer);

  return startedServer;
}

interface CloseStartedServerInput {
  readonly composition: AppComposition;
  readonly httpServer: StartedNodeHttpServer;
}

async function closeStartedServer(input: CloseStartedServerInput): Promise<void> {
  let firstError: unknown = null;

  try {
    await input.httpServer.close();
  } catch (error) {
    firstError = error;
  }

  try {
    await input.composition.close();
  } catch (error) {
    if (!firstError) {
      firstError = error;
    }
  }

  if (firstError) {
    throw firstError;
  }
}

interface CloseAfterStartFailureInput {
  readonly composition: AppComposition;
}

async function closeAfterStartFailure(input: CloseAfterStartFailureInput): Promise<void> {
  try {
    await input.composition.close();
  } catch {
    // Preserve the start failure. Startup failure is the actionable error for callers.
  }
}

function createNodeHttpServerOptions(config: HttpServerConfig): NodeHttpServerOptions {
  return {
    bind: {
      host: config.host,
      port: config.port,
    },
    body: {
      limitBytes: config.bodyLimitBytes,
    },
    staticFiles: {
      staticRoot: config.staticRoot,
    },
  };
}
