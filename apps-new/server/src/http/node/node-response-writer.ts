import { createReadStream } from 'node:fs';
import type { ServerResponse } from 'node:http';
import { pipeline } from 'node:stream/promises';
import type { HttpFileResponse, HttpResponse } from '../http-types.js';

export interface WriteNodeHttpResponseInput {
  readonly response: ServerResponse;
  readonly httpResponse: HttpResponse;
}

export async function writeNodeHttpResponse(input: WriteNodeHttpResponseInput): Promise<void> {
  switch (input.httpResponse.kind) {
    case 'json':
      writeResponseHead({
        response: input.response,
        statusCode: input.httpResponse.statusCode,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          ...input.httpResponse.headers,
        },
      });
      input.response.end(JSON.stringify(input.httpResponse.body));
      return;

    case 'text':
      writeResponseHead({
        response: input.response,
        statusCode: input.httpResponse.statusCode,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          ...input.httpResponse.headers,
        },
      });
      input.response.end(input.httpResponse.body);
      return;

    case 'empty':
      writeResponseHead({
        response: input.response,
        statusCode: input.httpResponse.statusCode,
        headers: input.httpResponse.headers,
      });
      input.response.end();
      return;

    case 'file':
      await writeFileResponse({
        response: input.response,
        httpResponse: input.httpResponse,
      });
      return;
  }
}

interface WriteResponseHeadInput {
  readonly response: ServerResponse;
  readonly statusCode: number;
  readonly headers: Readonly<Record<string, string>>;
}

function writeResponseHead(input: WriteResponseHeadInput): void {
  input.response.writeHead(input.statusCode, input.headers);
}

interface WriteFileResponseInput {
  readonly response: ServerResponse;
  readonly httpResponse: HttpFileResponse;
}

async function writeFileResponse(input: WriteFileResponseInput): Promise<void> {
  writeResponseHead({
    response: input.response,
    statusCode: input.httpResponse.statusCode,
    headers: {
      'content-type': input.httpResponse.contentType,
      ...input.httpResponse.headers,
    },
  });

  await pipeline(createReadStream(input.httpResponse.path), input.response);
}
