import type { JsonValue } from '@my-code-x/contracts-new/json';

export interface HttpRequest {
  readonly method: string;
  readonly path: string;
  readonly body: JsonValue | null;
}

export type HttpResponse = unknown;

export interface HttpHandler {
  handle(input: HttpRequest): Promise<HttpResponse>;
}
