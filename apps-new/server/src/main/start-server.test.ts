import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { startServerWithDependencies, type StartServerDependencies } from './start-server.js';
import type { AppComposition } from './composition-root.js';
import type { StartedNodeHttpServer, StartNodeHttpServerInput } from '../http/node/index.js';
import type { HttpRequest } from '../http/index.js';

describe('startServerWithDependencies', () => {
  test('closes composition when the Node HTTP server fails to start', async () => {
    const listenError = new Error('listen failed');
    const state = createStartServerTestState();

    await assert.rejects(
      () => startServerWithDependencies({
        createAppComposition: async () => state.composition,
        registerShutdown: state.registerShutdown,
        startNodeHttpServer: async () => {
          throw listenError;
        },
      }),
      (error: unknown) => error === listenError,
    );

    assert.equal(state.compositionClosed, true);
    assert.equal(state.shutdownRegistered, false);
  });

  test('starts Node HTTP server with mapped options and registers shutdown', async () => {
    const state = createStartServerTestState();
    const serverInputs: StartNodeHttpServerInput[] = [];

    const started = await startServerWithDependencies({
      createAppComposition: async () => state.composition,
      registerShutdown: state.registerShutdown,
      startNodeHttpServer: async input => {
        serverInputs.push(input);
        return state.httpServer;
      },
    });

    assert.equal(state.shutdownRegistered, true);
    assert.equal(serverInputs.length, 1);
    assert.deepEqual(serverInputs[0]?.options, {
      bind: {
        host: '127.0.0.1',
        port: 4311,
      },
      body: {
        limitBytes: 1024,
      },
      staticFiles: {
        staticRoot: 'D:\\static',
      },
    });

    await started.close();

    assert.equal(state.httpServerClosed, true);
    assert.equal(state.compositionClosed, true);
  });

  test('closes composition even when the HTTP server close fails', async () => {
    const closeError = new Error('close failed');
    const state = createStartServerTestState({
      httpCloseError: closeError,
    });
    const started = await startServerWithDependencies({
      createAppComposition: async () => state.composition,
      registerShutdown: state.registerShutdown,
      startNodeHttpServer: async () => state.httpServer,
    });

    await assert.rejects(() => started.close(), (error: unknown) => error === closeError);

    assert.equal(state.httpServerClosed, true);
    assert.equal(state.compositionClosed, true);
  });
});

interface StartServerTestStateInput {
  readonly httpCloseError?: Error;
}

interface StartServerTestState {
  readonly composition: AppComposition;
  readonly httpServer: StartedNodeHttpServer;
  readonly registerShutdown: StartServerDependencies['registerShutdown'];
  readonly compositionClosed: boolean;
  readonly httpServerClosed: boolean;
  readonly shutdownRegistered: boolean;
}

function createStartServerTestState(input: StartServerTestStateInput = {}): StartServerTestState {
  const state = {
    compositionClosed: false,
    httpServerClosed: false,
    shutdownRegistered: false,
  };
  const composition: AppComposition = {
    http: {
      async handle(_input: HttpRequest) {
        return {
          kind: 'empty',
          statusCode: 204,
          headers: {},
        };
      },
    },
    httpServer: {
      bodyLimitBytes: 1024,
      host: '127.0.0.1',
      port: 4311,
      staticRoot: 'D:\\static',
    },
    async close() {
      state.compositionClosed = true;
    },
  };
  const httpServer: StartedNodeHttpServer = {
    async close() {
      state.httpServerClosed = true;

      if (input.httpCloseError) {
        throw input.httpCloseError;
      }
    },
  };

  return {
    composition,
    httpServer,
    registerShutdown() {
      state.shutdownRegistered = true;
    },
    get compositionClosed() {
      return state.compositionClosed;
    },
    get httpServerClosed() {
      return state.httpServerClosed;
    },
    get shutdownRegistered() {
      return state.shutdownRegistered;
    },
  };
}
