import { createServer, type Server, type ServerResponse } from 'node:http';
import { createHttpErrorResponse } from '../http-error-response.js';
import { isHttpApplicationRoute } from '../http-route-policy.js';
import { errorResponse } from '../http-responses.js';
import type { HttpHandler, HttpRequest } from '../http-types.js';
import { readNodeHttpRequest, HttpRequestReadError } from './node-request-reader.js';
import { writeNodeHttpResponse } from './node-response-writer.js';
import { createStaticFileResponse } from './node-static-files.js';

export interface NodeHttpServerOptions {
  readonly bind: NodeHttpServerBindOptions;
  readonly body: NodeHttpBodyOptions;
  readonly staticFiles: NodeHttpStaticFileOptions;
}

export interface NodeHttpServerBindOptions {
  readonly host: string;
  readonly port: number;
}

export interface NodeHttpBodyOptions {
  readonly limitBytes: number;
}

export interface NodeHttpStaticFileOptions {
  readonly staticRoot: string;
}

export interface StartNodeHttpServerInput {
  readonly handler: HttpHandler;
  readonly options: NodeHttpServerOptions;
}

export interface StartedNodeHttpServer {
  close(): Promise<void>;
}

export async function startNodeHttpServer(input: StartNodeHttpServerInput): Promise<StartedNodeHttpServer> {
  const server = createServer(async (request, response) => {
    try {
      const httpRequest = await readNodeHttpRequest({
        request,
        bodyLimitBytes: input.options.body.limitBytes,
      });
      const httpResponse = await handleNodeRequest({
        request: httpRequest,
        handler: input.handler,
        options: input.options,
      });

      await writeNodeHttpResponse({ response, httpResponse });
    } catch (error) {
      if (!canWriteErrorResponse({ response })) {
        destroyResponse({ response, error });
        return;
      }

      const httpResponse = error instanceof HttpRequestReadError
        ? errorResponse({ statusCode: error.statusCode, body: error.message })
        : createHttpErrorResponse(error);

      await writeNodeHttpResponse({ response, httpResponse });
    }
  });

  await listen({
    server,
    host: input.options.bind.host,
    port: input.options.bind.port,
  });

  return {
    close() {
      return closeServer(server);
    },
  };
}

interface HandleNodeRequestInput {
  readonly request: HttpRequest;
  readonly handler: HttpHandler;
  readonly options: NodeHttpServerOptions;
}

async function handleNodeRequest(input: HandleNodeRequestInput) {
  if (isHttpApplicationRoute({ path: input.request.path })) {
    return input.handler.handle(input.request);
  }

  return createStaticFileResponse({
    config: {
      staticRoot: input.options.staticFiles.staticRoot,
    },
    path: input.request.path,
  });
}

interface CanWriteErrorResponseInput {
  readonly response: ServerResponse;
}

function canWriteErrorResponse(input: CanWriteErrorResponseInput): boolean {
  return !input.response.headersSent && !input.response.writableEnded;
}

interface DestroyResponseInput {
  readonly response: ServerResponse;
  readonly error: unknown;
}

function destroyResponse(input: DestroyResponseInput): void {
  if (input.error instanceof Error) {
    input.response.destroy(input.error);
    return;
  }

  input.response.destroy();
}

interface ListenInput {
  readonly server: Server;
  readonly host: string;
  readonly port: number;
}

function listen(input: ListenInput): Promise<void> {
  return new Promise((resolve, reject) => {
    input.server.once('error', reject);
    input.server.listen(input.port, input.host, () => {
      input.server.off('error', reject);
      resolve();
    });
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close(error => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
