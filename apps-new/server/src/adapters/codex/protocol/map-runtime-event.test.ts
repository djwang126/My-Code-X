import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { CodexProtocolError } from '../runtime/codex-runtime-error.js';
import type { CodexRuntimeLogger } from '../runtime/codex-runtime-logger.js';
import type { CodexIncomingMessage } from '../transport/jsonl-message.js';
import { mapCodexIncomingMessageToRuntimeEvent } from './map-runtime-event.js';

interface TestLogger {
  readonly logger: CodexRuntimeLogger;
  readonly warnings: readonly string[];
}

function createTestLogger(): TestLogger {
  const warnings: string[] = [];

  return {
    logger: {
      warn(message: string) {
        warnings.push(message);
      },
    },
    warnings,
  };
}

function mapMessage(message: CodexIncomingMessage, testLogger = createTestLogger()) {
  return mapCodexIncomingMessageToRuntimeEvent({
    message,
    logger: testLogger.logger,
  });
}

describe('mapCodexIncomingMessageToRuntimeEvent', () => {
  test('maps a Codex server request into an internal runtime input event', () => {
    const event = mapMessage({
      kind: 'server-request',
      id: 'request-1',
      method: 'approval/request',
      params: {
        threadId: 'thread-1',
        title: 'Approve command',
        prompt: 'Run npm test?',
      },
    });

    assert.deepEqual(event, {
      kind: 'runtime-input-requested',
      requestId: 'request-1',
      threadId: 'thread-1',
      inputKind: 'approval',
      title: 'Approve command',
      prompt: 'Run npm test?',
    });
  });

  test('maps turn/started into a runtime turn-started event', () => {
    const event = mapMessage({
      kind: 'notification',
      method: 'turn/started',
      params: {
        threadId: 'thread-1',
        turn: {
          id: 'turn-1',
        },
      },
    });

    assert.deepEqual(event, {
      kind: 'runtime-turn-started',
      threadId: 'thread-1',
      turnId: 'turn-1',
    });
  });

  test('maps item delta notifications into runtime output updates', () => {
    const event = mapMessage({
      kind: 'notification',
      method: 'item/agentMessage/delta',
      params: {
        threadId: 'thread-1',
        turnId: 'turn-1',
        itemId: 'item-1',
        delta: 'hello',
      },
    });

    assert.deepEqual(event, {
      kind: 'runtime-output-updated',
      threadId: 'thread-1',
      turnId: 'turn-1',
      itemId: 'item-1',
      outputKind: 'text-delta',
      text: 'hello',
    });
  });

  test('maps item lifecycle notifications into runtime output updates', () => {
    const events = [
      mapMessage({
        kind: 'notification',
        method: 'item/started',
        params: {
          threadId: 'thread-1',
          turnId: 'turn-1',
          item: {
            id: 'item-started',
            text: 'started',
          },
        },
      }),
      mapMessage({
        kind: 'notification',
        method: 'item/updated',
        params: {
          threadId: 'thread-1',
          turnId: 'turn-1',
          itemId: 'item-updated',
          message: 'updated',
        },
      }),
      mapMessage({
        kind: 'notification',
        method: 'item/completed',
        params: {
          threadId: 'thread-1',
          itemId: 'item-completed',
          text: 'completed',
        },
      }),
    ];

    assert.deepEqual(events, [
      {
        kind: 'runtime-output-updated',
        threadId: 'thread-1',
        turnId: 'turn-1',
        itemId: 'item-started',
        outputKind: 'item-started',
        text: 'started',
      },
      {
        kind: 'runtime-output-updated',
        threadId: 'thread-1',
        turnId: 'turn-1',
        itemId: 'item-updated',
        outputKind: 'item-updated',
        text: 'updated',
      },
      {
        kind: 'runtime-output-updated',
        threadId: 'thread-1',
        turnId: null,
        itemId: 'item-completed',
        outputKind: 'item-completed',
        text: 'completed',
      },
    ]);
  });

  test('maps turn/completed into a terminal runtime event with error details', () => {
    const event = mapMessage({
      kind: 'notification',
      method: 'turn/completed',
      params: {
        threadId: 'thread-1',
        turn: {
          id: 'turn-1',
          status: 'failed',
          error: {
            message: 'tool failed',
            code: 'TOOL_FAILED',
          },
        },
      },
    });

    assert.deepEqual(event, {
      kind: 'runtime-turn-completed',
      threadId: 'thread-1',
      turnId: 'turn-1',
      status: 'failed',
      error: {
        message: 'tool failed',
        code: 'TOOL_FAILED',
      },
    });
  });

  test('maps Codex notice payloads into runtime system notices', () => {
    const event = mapMessage({
      kind: 'notification',
      method: 'system/notice',
      params: {
        threadId: 'thread-1',
        level: 'warning',
        message: 'low context',
      },
    });

    assert.deepEqual(event, {
      kind: 'runtime-system-notice',
      threadId: 'thread-1',
      level: 'warning',
      message: 'low context',
    });
  });

  test('maps notice alias payloads into runtime system notices', () => {
    const event = mapMessage({
      kind: 'notification',
      method: 'notice',
      params: {
        severity: 'error',
        text: 'disk full',
      },
    });

    assert.deepEqual(event, {
      kind: 'runtime-system-notice',
      threadId: null,
      level: 'error',
      message: 'disk full',
    });
  });

  test('maps Codex error payloads into runtime errors', () => {
    const event = mapMessage({
      kind: 'notification',
      method: 'error',
      params: {
        threadId: 'thread-1',
        turnId: 'turn-1',
        error: {
          message: 'runtime failed',
          code: 'RUNTIME_FAILED',
        },
      },
    });

    assert.deepEqual(event, {
      kind: 'runtime-error',
      threadId: 'thread-1',
      turnId: 'turn-1',
      error: {
        message: 'runtime failed',
        code: 'RUNTIME_FAILED',
      },
    });
  });

  test('maps realtime thread errors into runtime errors', () => {
    const event = mapMessage({
      kind: 'notification',
      method: 'thread/realtime/error',
      params: {
        threadId: 'thread-1',
        reason: 'stream closed',
      },
    });

    assert.deepEqual(event, {
      kind: 'runtime-error',
      threadId: 'thread-1',
      turnId: null,
      error: {
        message: 'stream closed',
        code: null,
      },
    });
  });

  test('ignores unknown Codex notifications and logs the ignored payload', () => {
    const testLogger = createTestLogger();
    const event = mapMessage(
      {
        kind: 'notification',
        method: 'unknown/event',
        params: {
          value: 1,
        },
      },
      testLogger,
    );

    assert.equal(event, null);
    assert.deepEqual(testLogger.warnings, [
      '[server-new codex] ignored unknown Codex message: {"method":"unknown/event","params":{"value":1}}',
    ]);
  });

  test('rejects malformed known Codex notifications instead of leaking raw payloads', () => {
    assert.throws(
      () =>
        mapMessage({
          kind: 'notification',
          method: 'turn/started',
          params: {
            turn: {
              id: 'turn-1',
            },
          },
        }),
      (error: unknown) =>
        error instanceof CodexProtocolError &&
        error.message === 'Codex turn/started threadId must be a string',
      );
  });

  test('rejects unsupported terminal turn statuses at the adapter boundary', () => {
    assert.throws(
      () =>
        mapMessage({
          kind: 'notification',
          method: 'turn/completed',
          params: {
            threadId: 'thread-1',
            turn: {
              id: 'turn-1',
              status: 'cancelled',
            },
          },
        }),
      (error: unknown) =>
        error instanceof CodexProtocolError && error.message === 'Unsupported Codex turn status: cancelled',
    );
  });
});
