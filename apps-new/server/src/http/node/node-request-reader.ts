import type { IncomingMessage } from 'node:http';
import { isJsonValue } from '@my-code-x/contracts-new/json';
import type { JsonValue } from '@my-code-x/contracts-new/json';
import type { HttpAbortSignal, HttpHeaders, HttpMethod, HttpQuery, HttpRequest } from '../http-types.js';

export class HttpRequestReadError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpRequestReadError';
  }
}

export interface ReadNodeHttpRequestInput {
  readonly request: IncomingMessage;
  readonly bodyLimitBytes: number;
}

export async function readNodeHttpRequest(input: ReadNodeHttpRequestInput): Promise<HttpRequest> {
  const method = readHttpMethod(input.request.method);
  const url = readRequestUrl(input.request.url);
  const headers = readHeaders(input.request);
  const rawBody = await readRawBody({
    request: input.request,
    limitBytes: input.bodyLimitBytes,
  });

  return {
    method,
    path: url.pathname,
    query: readQuery(url),
    headers,
    body: parseBody({ rawBody, headers }),
    rawBody,
    signal: createRequestSignal(input.request),
  };
}

function readHttpMethod(method: string | undefined): HttpMethod {
  switch (method) {
    case 'GET':
    case 'POST':
    case 'PUT':
    case 'PATCH':
    case 'DELETE':
    case 'OPTIONS':
    case 'HEAD':
      return method;

    default:
      throw new HttpRequestReadError(405, 'Method not allowed');
  }
}

function readRequestUrl(value: string | undefined): URL {
  return new URL(value ?? '/', 'http://localhost');
}

function readHeaders(request: IncomingMessage): HttpHeaders {
  const headers: Record<string, string> = {};

  for (const [name, value] of Object.entries(request.headers)) {
    if (value === undefined) {
      continue;
    }

    headers[name.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value;
  }

  return headers;
}

function readQuery(url: URL): HttpQuery {
  const query: Record<string, string | readonly string[]> = {};

  for (const [key, value] of url.searchParams) {
    const current = query[key];

    if (current === undefined) {
      query[key] = value;
      continue;
    }

    query[key] = Array.isArray(current) ? [...current, value] : [current, value];
  }

  return query;
}

interface ReadRawBodyInput {
  readonly request: IncomingMessage;
  readonly limitBytes: number;
}

async function readRawBody(input: ReadRawBodyInput): Promise<string | null> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of input.request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    size += buffer.byteLength;

    if (size > input.limitBytes) {
      throw new HttpRequestReadError(413, 'Request body is too large');
    }

    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    return null;
  }

  return Buffer.concat(chunks).toString('utf-8');
}

interface ParseBodyInput {
  readonly rawBody: string | null;
  readonly headers: HttpHeaders;
}

function parseBody(input: ParseBodyInput): JsonValue | string | null {
  if (input.rawBody === null || input.rawBody.length === 0) {
    return null;
  }

  if (!isJsonContentType(input.headers)) {
    return input.rawBody;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(input.rawBody) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new HttpRequestReadError(400, `Request body must be valid JSON: ${message}`);
  }

  if (!isJsonValue(parsed)) {
    throw new HttpRequestReadError(400, 'Request body must be JSON-compatible');
  }

  return parsed;
}

function isJsonContentType(headers: HttpHeaders): boolean {
  const contentType = headers['content-type'] ?? '';
  return contentType.toLowerCase().split(';')[0]?.trim() === 'application/json';
}

function createRequestSignal(request: IncomingMessage): HttpAbortSignal {
  const controller = new globalThis.AbortController();

  request.on('aborted', () => {
    controller.abort();
  });

  return controller.signal;
}
