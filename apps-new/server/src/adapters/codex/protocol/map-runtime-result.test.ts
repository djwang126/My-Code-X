import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { CodexProtocolError } from '../runtime/codex-runtime-error.js';
import { mapCodexResultToRuntimeResult } from './map-runtime-result.js';

describe('mapCodexResultToRuntimeResult', () => {
  test('maps a Codex thread/start result into an internal thread-started result', () => {
    const result = mapCodexResultToRuntimeResult({
      command: {
        kind: 'start-thread',
        workspace: '/workspace',
        runtimeSettings: null,
        baseInstructions: null,
      },
      result: {
        thread: {
          id: 'thread-1',
        },
      },
    });

    assert.deepEqual(result, {
      kind: 'thread-started',
      threadId: 'thread-1',
    });
  });

  test('maps a Codex thread/resume result into a typed snapshot', () => {
    const result = mapCodexResultToRuntimeResult({
      command: {
        kind: 'resume-thread',
        threadId: 'thread-1',
        workspace: '/workspace',
        runtimeSettings: null,
        baseInstructions: null,
      },
      result: {
        threadId: 'thread-1',
        threadName: 'Thread title',
        messages: [
          {
            id: 'item-1',
            type: 'assistant_message',
            status: 'complete',
            text: 'hello',
          },
        ],
        pendingRequests: [
          {
            id: 'request-1',
            type: 'approval',
            prompt: 'Approve?',
          },
        ],
      },
    });

    assert.deepEqual(result, {
      kind: 'thread-resumed',
      threadId: 'thread-1',
      snapshot: {
        threadId: 'thread-1',
        title: 'Thread title',
        items: [
          {
            itemId: 'item-1',
            itemKind: 'assistant_message',
            status: 'complete',
            text: 'hello',
          },
        ],
        pendingInputs: [
          {
            requestId: 'request-1',
            inputKind: 'approval',
            prompt: 'Approve?',
          },
        ],
      },
    });
  });

  test('maps a Codex thread/list result into internal listed threads', () => {
    const result = mapCodexResultToRuntimeResult({
      command: {
        kind: 'list-threads',
        workspace: '/workspace',
        limit: 10,
        archived: false,
      },
      result: {
        threads: [
          {
            id: 'thread-1',
            title: 'First',
            cwd: '/workspace',
            updated_at: '2026-04-27T00:00:00.000Z',
          },
        ],
      },
    });

    assert.deepEqual(result, {
      kind: 'threads-listed',
      threads: [
        {
          threadId: 'thread-1',
          title: 'First',
          workspace: '/workspace',
          updatedAt: '2026-04-27T00:00:00.000Z',
        },
      ],
    });
  });

  test('maps a Codex turn/start result into an internal turn-started result', () => {
    const result = mapCodexResultToRuntimeResult({
      command: {
        kind: 'start-turn',
        threadId: 'thread-1',
        message: 'Hello',
        content: [],
        runtimeSettings: null,
      },
      result: {
        turn: {
          id: 'turn-1',
        },
      },
    });

    assert.deepEqual(result, {
      kind: 'turn-started',
      turnId: 'turn-1',
    });
  });

  test('maps a Codex turn/interrupt result into an ok result', () => {
    const result = mapCodexResultToRuntimeResult({
      command: {
        kind: 'interrupt-turn',
        threadId: 'thread-1',
        turnId: null,
      },
      result: {
        ok: true,
      },
    });

    assert.deepEqual(result, {
      kind: 'ok',
    });
  });

  test('rejects malformed listed threads at the adapter boundary', () => {
    assert.throws(
      () =>
        mapCodexResultToRuntimeResult({
          command: {
            kind: 'list-threads',
            workspace: '/workspace',
            limit: 10,
            archived: false,
          },
          result: {
            threads: [
              {
                title: 'Missing id',
              },
            ],
          },
        }),
      (error: unknown) =>
        error instanceof CodexProtocolError &&
        error.message === 'Codex listed thread is missing id',
      );
  });

  test('rejects a present thread list field that is not an array', () => {
    assert.throws(
      () =>
        mapCodexResultToRuntimeResult({
          command: {
            kind: 'list-threads',
            workspace: '/workspace',
            limit: 10,
            archived: false,
          },
          result: {
            threads: 'not-an-array',
          },
        }),
      (error: unknown) =>
        error instanceof CodexProtocolError &&
        error.message === 'Codex thread list result.threads must be an array',
    );
  });

  test('rejects non-object thread list items at the adapter boundary', () => {
    assert.throws(
      () =>
        mapCodexResultToRuntimeResult({
          command: {
            kind: 'list-threads',
            workspace: '/workspace',
            limit: 10,
            archived: false,
          },
          result: {
            threads: ['thread-1'],
          },
        }),
      (error: unknown) =>
        error instanceof CodexProtocolError &&
        error.message === 'Codex listed thread must be an object',
    );
  });

  test('rejects present resume timeline fields that are not arrays', () => {
    assert.throws(
      () =>
        mapCodexResultToRuntimeResult({
          command: {
            kind: 'resume-thread',
            threadId: 'thread-1',
            workspace: '/workspace',
            runtimeSettings: null,
            baseInstructions: null,
          },
          result: {
            threadId: 'thread-1',
            messages: 'not-an-array',
          },
        }),
      (error: unknown) =>
        error instanceof CodexProtocolError &&
        error.message === 'Codex resume result timeline items must be an array',
    );
  });

  test('rejects present resume pending request fields that are not arrays', () => {
    assert.throws(
      () =>
        mapCodexResultToRuntimeResult({
          command: {
            kind: 'resume-thread',
            threadId: 'thread-1',
            workspace: '/workspace',
            runtimeSettings: null,
            baseInstructions: null,
          },
          result: {
            threadId: 'thread-1',
            pendingRequests: 'not-an-array',
          },
        }),
      (error: unknown) =>
        error instanceof CodexProtocolError &&
        error.message === 'Codex resume result pendingRequests must be an array',
    );
  });

  test('rejects resume timeline items without an id at the adapter boundary', () => {
    assert.throws(
      () =>
        mapCodexResultToRuntimeResult({
          command: {
            kind: 'resume-thread',
            threadId: 'thread-1',
            workspace: '/workspace',
            runtimeSettings: null,
            baseInstructions: null,
          },
          result: {
            threadId: 'thread-1',
            messages: [
              {
                text: 'missing id',
              },
            ],
          },
        }),
      (error: unknown) =>
        error instanceof CodexProtocolError &&
        error.message === 'Codex timeline item is missing id',
    );
  });

  test('rejects resume pending inputs without an id at the adapter boundary', () => {
    assert.throws(
      () =>
        mapCodexResultToRuntimeResult({
          command: {
            kind: 'resume-thread',
            threadId: 'thread-1',
            workspace: '/workspace',
            runtimeSettings: null,
            baseInstructions: null,
          },
          result: {
            threadId: 'thread-1',
            pendingRequests: [
              {
                prompt: 'Approve?',
              },
            ],
          },
        }),
      (error: unknown) =>
        error instanceof CodexProtocolError &&
        error.message === 'Codex pending input is missing id',
    );
  });

  test('rejects malformed turn start results at the adapter boundary', () => {
    assert.throws(
      () =>
        mapCodexResultToRuntimeResult({
          command: {
            kind: 'start-turn',
            threadId: 'thread-1',
            message: 'Hello',
            content: [],
            runtimeSettings: null,
          },
          result: {
            turn: {},
          },
        }),
      (error: unknown) => error instanceof CodexProtocolError && error.message === 'Codex turn id must be a string',
    );
  });
});
