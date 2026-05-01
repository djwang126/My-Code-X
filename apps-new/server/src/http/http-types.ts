import type { JsonValue } from '@my-code-x/contracts-new/json';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

export interface HttpRequest {
  readonly method: HttpMethod;
  readonly path: string;
  readonly query: HttpQuery;
  readonly headers: HttpHeaders;
  readonly body: JsonValue | string | null;
  readonly rawBody: string | null;
  readonly signal: HttpAbortSignal;
}

export interface HttpAbortSignal {
  readonly aborted: boolean;
}

export interface HttpQuery {
  readonly [key: string]: string | readonly string[];
}

export interface HttpHeaders {
  readonly [key: string]: string;
}

export type HttpResponse =
  | HttpJsonResponse
  | HttpTextResponse
  | HttpEmptyResponse
  | HttpFileResponse;

export type HttpJsonBody = JsonValue;

export interface HttpResponseBase {
  readonly statusCode: number;
  readonly headers: HttpHeaders;
}

export interface HttpJsonResponse extends HttpResponseBase {
  readonly kind: 'json';
  readonly body: HttpJsonBody;
}

export interface HttpTextResponse extends HttpResponseBase {
  readonly kind: 'text';
  readonly body: string;
}

export interface HttpEmptyResponse extends HttpResponseBase {
  readonly kind: 'empty';
}

export interface HttpFileResponse extends HttpResponseBase {
  readonly kind: 'file';
  readonly path: string;
  readonly contentType: string;
}

export interface HttpHandler {
  handle(input: HttpRequest): Promise<HttpResponse>;
}
