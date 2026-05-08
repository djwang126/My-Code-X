import type { IncomingMessage, ServerResponse } from 'node:http';

export type AppRequest = IncomingMessage;
export type AppResponse = ServerResponse<IncomingMessage>;
export type JsonBody = Record<string, unknown>;
