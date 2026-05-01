import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import { describe, test } from 'node:test';

import { writeNodeHttpResponse } from './node-response-writer.js';

describe('writeNodeHttpResponse', () => {
  test('writes JSON responses with JSON content type', async () => {
    const response = new TestServerResponse();

    await writeNodeHttpResponse({
      response: response.asServerResponse(),
      httpResponse: {
        kind: 'json',
        statusCode: 200,
        headers: {},
        body: {
          ok: true,
        },
      },
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers['content-type'], 'application/json; charset=utf-8');
    assert.equal(response.body(), '{"ok":true}');
  });

  test('writes text responses with text content type', async () => {
    const response = new TestServerResponse();

    await writeNodeHttpResponse({
      response: response.asServerResponse(),
      httpResponse: {
        kind: 'text',
        statusCode: 201,
        headers: {},
        body: 'created',
      },
    });

    assert.equal(response.status, 201);
    assert.equal(response.headers['content-type'], 'text/plain; charset=utf-8');
    assert.equal(response.body(), 'created');
  });

  test('writes empty responses without a body', async () => {
    const response = new TestServerResponse();

    await writeNodeHttpResponse({
      response: response.asServerResponse(),
      httpResponse: {
        kind: 'empty',
        statusCode: 204,
        headers: {
          'x-empty': 'yes',
        },
      },
    });

    assert.equal(response.status, 204);
    assert.equal(response.headers['x-empty'], 'yes');
    assert.equal(response.body(), '');
  });

  test('streams file responses with the provided content type', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'my-code-x-response-'));

    try {
      const filePath = path.join(tempRoot, 'hello.txt');
      await writeFile(filePath, 'hello file', 'utf-8');
      const response = new TestServerResponse();

      await writeNodeHttpResponse({
        response: response.asServerResponse(),
        httpResponse: {
          kind: 'file',
          statusCode: 200,
          headers: {},
          path: filePath,
          contentType: 'text/plain; charset=utf-8',
        },
      });

      assert.equal(response.status, 200);
      assert.equal(response.headers['content-type'], 'text/plain; charset=utf-8');
      assert.equal(response.body(), 'hello file');
    } finally {
      await rm(tempRoot, {
        force: true,
        recursive: true,
      });
    }
  });
});

class TestServerResponse extends Writable {
  public status = 0;
  public headers: Record<string, string> = {};
  private readonly chunks: Buffer[] = [];

  writeHead(statusCode: number, headers: Readonly<Record<string, string>>): this {
    this.status = statusCode;
    this.headers = {
      ...headers,
    };
    return this;
  }

  asServerResponse(): ServerResponse {
    return this as unknown as ServerResponse;
  }

  body(): string {
    return Buffer.concat(this.chunks).toString('utf-8');
  }

  override _write(chunk: Buffer | string, _encoding: string, callback: (error?: Error | null) => void): void {
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    callback();
  }
}
