import { isJsonValue } from '@my-code-x/contracts-new/json';
import { BoundaryError } from '../shared/index.js';
import type { HttpEmptyResponse, HttpFileResponse, HttpHeaders, HttpJsonBody, HttpJsonResponse, HttpTextResponse } from './http-types.js';

export interface CreateJsonResponseInput {
  readonly statusCode: number;
  readonly body: unknown;
  readonly headers?: HttpHeaders;
}

export interface CreateTextResponseInput {
  readonly statusCode: number;
  readonly body: string;
  readonly headers?: HttpHeaders;
}

export interface CreateEmptyResponseInput {
  readonly statusCode: number;
  readonly headers?: HttpHeaders;
}

export interface CreateFileResponseInput {
  readonly statusCode: number;
  readonly path: string;
  readonly contentType: string;
  readonly headers?: HttpHeaders;
}

export function jsonResponse(input: CreateJsonResponseInput): HttpJsonResponse {
  return {
    kind: 'json',
    statusCode: input.statusCode,
    headers: input.headers ?? {},
    body: readJsonResponseBody(input.body),
  };
}

export function textResponse(input: CreateTextResponseInput): HttpTextResponse {
  return {
    kind: 'text',
    statusCode: input.statusCode,
    headers: input.headers ?? {},
    body: input.body,
  };
}

export function emptyResponse(input: CreateEmptyResponseInput): HttpEmptyResponse {
  return {
    kind: 'empty',
    statusCode: input.statusCode,
    headers: input.headers ?? {},
  };
}

export function fileResponse(input: CreateFileResponseInput): HttpFileResponse {
  return {
    kind: 'file',
    statusCode: input.statusCode,
    headers: input.headers ?? {},
    path: input.path,
    contentType: input.contentType,
  };
}

export function errorResponse(input: CreateTextResponseInput): HttpJsonResponse {
  return jsonResponse({
    statusCode: input.statusCode,
    headers: input.headers,
    body: {
      error: {
        message: input.body,
      },
    },
  });
}

function readJsonResponseBody(body: unknown): HttpJsonBody {
  if (!isJsonValue(body)) {
    throw new BoundaryError('HTTP JSON response body must be JSON-compatible');
  }

  return body;
}
