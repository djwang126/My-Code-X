import assert from 'node:assert/strict';
import type { IncomingMessage } from 'node:http';
import { Readable } from 'node:stream';
import { describe, test } from 'node:test';

import { HttpRequestReadError, readNodeHttpRequest } from './node-request-reader.js';

describe('readNodeHttpRequest', () => {
  test('reads method, path, query, headers, and JSON body', async () => {
    const request = createIncomingMessage({
      body: JSON.stringify({ ok: true }),
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
      method: 'POST',
      url: '/client?tag=one&tag=two&search=hello',
    });

    const parsed = await readNodeHttpRequest({
      request,
      bodyLimitBytes: 1024,
    });

    assert.equal(parsed.method, 'POST');
    assert.equal(parsed.path, '/client');
    assert.deepEqual(parsed.query, {
      search: 'hello',
      tag: ['one', 'two'],
    });
    assert.equal(parsed.headers['content-type'], 'application/json; charset=utf-8');
    assert.deepEqual(parsed.body, {
      ok: true,
    });
    assert.equal(parsed.rawBody, '{"ok":true}');
    assert.equal(parsed.signal.aborted, false);
  });

  test('rejects invalid JSON body at the network boundary', async () => {
    const request = createIncomingMessage({
      body: '{',
      headers: {
        'content-type': 'application/json',
      },
      method: 'POST',
      url: '/client',
    });

    await assert.rejects(
      () => readNodeHttpRequest({ request, bodyLimitBytes: 1024 }),
      (error: unknown) => error instanceof HttpRequestReadError && error.statusCode === 400,
    );
  });

  test('rejects bodies larger than the configured limit', async () => {
    const request = createIncomingMessage({
      body: 'too-large',
      headers: {
        'content-type': 'text/plain',
      },
      method: 'POST',
      url: '/client',
    });

    await assert.rejects(
      () => readNodeHttpRequest({ request, bodyLimitBytes: 3 }),
      (error: unknown) => error instanceof HttpRequestReadError && error.statusCode === 413,
    );
  });
});

interface CreateIncomingMessageInput {
  readonly body: string;
  readonly headers: IncomingMessage['headers'];
  readonly method: string;
  readonly url: string;
}

function createIncomingMessage(input: CreateIncomingMessageInput): IncomingMessage {
  const request = Readable.from([input.body]) as IncomingMessage;
  request.headers = input.headers;
  request.method = input.method;
  request.url = input.url;
  return request;
}
