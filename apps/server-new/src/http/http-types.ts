export type HttpRequest = unknown;
export type HttpResponse = unknown;

export interface HttpHandler {
  handle(input: HttpRequest): Promise<HttpResponse>;
}