import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { CodexProtocolError } from '../errors/codex-runtime-error.js';
import { parseCodexIncomingMessage } from './codex-message.js';
import { parseJsonValue } from './reader/index.js';

describe('parseJsonValue', () => {
  test('rejects invalid JSONL input with a protocol error', () => {
    assert.throws(
      () => parseJsonValue('{not-json'),
      (error: unknown) =>
        error instanceof CodexProtocolError &&
        error.message.startsWith('Codex JSONL message is not valid JSON:'),
    );
  });

  test('rejects object-like input that is not valid JSON', () => {
    assert.throws(
      () => parseJsonValue('{"value":undefined}'),
      (error: unknown) =>
        error instanceof CodexProtocolError &&
        error.message.startsWith('Codex JSONL message is not valid JSON:'),
    );
  });
});

describe('parseCodexIncomingMessage', () => {
  test('rejects a top-level JSON value that is not an object message', () => {
    assert.throws(
      () => parseCodexIncomingMessage('[]'),
      (error: unknown) => error instanceof CodexProtocolError && error.message === 'Codex JSONL message must be an object',
    );
  });

  test('parses a Codex response message', () => {
    const message = parseCodexIncomingMessage('{"id":"1","result":{"thread":{"id":"thread-1"}}}');

    assert.deepEqual(message, {
      kind: 'response',
      id: '1',
      result: {
        thread: {
          id: 'thread-1',
        },
      },
    });
  });

  test('normalizes a response without an explicit result to null', () => {
    const message = parseCodexIncomingMessage('{"id":"1"}');

    assert.deepEqual(message, {
      kind: 'response',
      id: '1',
      result: null,
    });
  });

  test('parses a Codex error response message', () => {
    const message = parseCodexIncomingMessage('{"id":"2","error":{"code":400,"message":"bad request"}}');

    assert.deepEqual(message, {
      kind: 'error-response',
      id: '2',
      error: {
        code: 400,
        message: 'bad request',
      },
    });
  });

  test('rejects an error response with a non-object error payload', () => {
    assert.throws(
      () => parseCodexIncomingMessage('{"id":"2","error":"bad request"}'),
      (error: unknown) => error instanceof CodexProtocolError && error.message === 'Codex error response must be an object',
    );
  });

  test('parses a Codex notification and normalizes missing params to an empty object', () => {
    const message = parseCodexIncomingMessage('{"method":"turn/started"}');

    assert.deepEqual(message, {
      kind: 'notification',
      method: 'turn/started',
      params: {},
    });
  });

  test('parses a Codex server request separately from a notification', () => {
    const message = parseCodexIncomingMessage(
      '{"id":"server-1","method":"approval/request","params":{"threadId":"thread-1","prompt":"Approve?"}}',
    );

    assert.deepEqual(message, {
      kind: 'server-request',
      id: 'server-1',
      method: 'approval/request',
      params: {
        threadId: 'thread-1',
        prompt: 'Approve?',
      },
    });
  });

  test('rejects a response message without an id', () => {
    assert.throws(
      () => parseCodexIncomingMessage('{"result":{"ok":true}}'),
      (error: unknown) =>
        error instanceof CodexProtocolError &&
        error.message === 'Codex response message is missing id',
    );
  });

  test('rejects a notification with non-object params', () => {
    assert.throws(
      () => parseCodexIncomingMessage('{"method":"turn/started","params":5}'),
      (error: unknown) =>
        error instanceof CodexProtocolError &&
        error.message === 'Codex notification params must be an object',
    );
  });

  test('rejects a server request with non-object params', () => {
    assert.throws(
      () => parseCodexIncomingMessage('{"id":"server-1","method":"approval/request","params":5}'),
      (error: unknown) =>
        error instanceof CodexProtocolError && error.message === 'Codex server request params must be an object',
    );
  });
});


