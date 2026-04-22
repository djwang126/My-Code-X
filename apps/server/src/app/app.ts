import type { AppRequest, AppResponse } from '../common/http/http-types.js';
import {
  authToken as defaultAuthToken,
  frontendDistDir as defaultFrontendDistDir,
  serverInstanceId as defaultServerInstanceId,
} from '../config/config.js';
import { isAuthorized } from '../common/auth/index.js';
import { createHttpError, serializeError } from '../common/errors/http-error.js';
import { tryServeStaticApp } from '../common/static/index.js';
import { handleAppRestartRoute, handleAppRestartShutdownRoute } from '../modules/app-control/index.js';
import { createUnconfiguredChatService } from '../modules/chat/index.js';
import { tryHandleChatRoutes } from '../modules/chat/index.js';
import { handleHealthRoute } from '../modules/health/index.js';
import { createSessionService, handleSessionRoute } from '../modules/session/index.js';
import {
  createWorkspaceFilesService,
  handleWorkspaceFileReadRoute,
  handleWorkspaceFileSaveRoute,
  handleWorkspaceFilesRoute,
} from '../modules/workspace/index.js';

type ChatService = ReturnType<typeof createUnconfiguredChatService>;
type RestartRouteHandler = ((payload: {
  viewerId: string;
  slotId: string;
  workspace: string;
  threadId: string;
}) => Promise<unknown>) | null;
type RestartShutdownRouteHandler = ((payload: { token: string }) => Promise<unknown>) | null;

export function createApp({
  authToken = defaultAuthToken,
  serverInstanceId = defaultServerInstanceId,
  frontendDistDir = defaultFrontendDistDir,
  chatService: chatServiceOverrides = {},
  workspaceFilesService = createWorkspaceFilesService(),
  restartHandler = null,
  restartShutdownHandler = null,
}: {
  authToken?: string;
  serverInstanceId?: string;
  frontendDistDir?: string;
  chatService?: Record<string, unknown>;
  workspaceFilesService?: ReturnType<typeof createWorkspaceFilesService>;
  restartHandler?: RestartRouteHandler;
  restartShutdownHandler?: RestartShutdownRouteHandler;
} = {}) {
  const chatService: ChatService = {
    ...createUnconfiguredChatService(),
    ...chatServiceOverrides,
  } as ChatService;

  const sessionService = createSessionService({
    serverInstanceId,
    authRequired: Boolean(authToken),
    chatService,
  });

  return async function app(request: AppRequest, response: AppResponse) {
    const url = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`);
    const isApiRoute = url.pathname.startsWith('/api/');

    if (request.method === 'GET' && !isApiRoute) {
      const served = await tryServeStaticApp(response, frontendDistDir, url.pathname);
      if (served) return;
    }

    if (isApiRoute && !isAuthorized(request, authToken)) {
      response.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ ...serializeError(createHttpError('unauthorized', 401)), authRequired: true }));
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/health') {
      handleHealthRoute(response, { authRequired: Boolean(authToken), serverInstanceId });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/v2/session') {
      await handleSessionRoute(request, response, { sessionService });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/v2/workspace/files') {
      await handleWorkspaceFilesRoute(request, response, { workspaceFilesService });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/v2/workspace/file') {
      await handleWorkspaceFileReadRoute(request, response, { workspaceFilesService });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/v2/workspace/file') {
      await handleWorkspaceFileSaveRoute(request, response, { workspaceFilesService });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/v2/app/restart') {
      await handleAppRestartRoute(request, response, { restartHandler });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/v2/app/restart/shutdown') {
      await handleAppRestartShutdownRoute(request, response, { restartShutdownHandler });
      return;
    }

    if (await tryHandleChatRoutes(request, response, { url, chatService })) {
      return;
    }

    response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify(serializeError(createHttpError('not_found', 404))));
  };
}
