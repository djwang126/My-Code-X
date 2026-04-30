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
      method: 'approval/request',
      threadId: 'thread-1',
      turnId: null,
      itemId: null,
      inputKind: 'approval',
      title: 'Approve command',
      prompt: 'Run npm test?',
      data: {
        threadId: 'thread-1',
        title: 'Approve command',
        prompt: 'Run npm test?',
      },
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

  test('maps item delta notifications into runtime item delta events', () => {
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
      kind: 'runtime-item-delta',
      threadId: 'thread-1',
      turnId: 'turn-1',
      itemId: 'item-1',
      deltaKind: 'agent-message',
      text: 'hello',
      data: {
        threadId: 'thread-1',
        turnId: 'turn-1',
        itemId: 'item-1',
        delta: 'hello',
      },
    });
  });

  test('maps item lifecycle notifications into runtime item lifecycle events', () => {
    const events = [
      mapMessage({
        kind: 'notification',
        method: 'item/started',
        params: {
          threadId: 'thread-1',
          turnId: 'turn-1',
          item: {
            type: 'agentMessage',
            id: 'item-started',
            text: 'started',
          },
        },
      }),
      mapMessage({
        kind: 'notification',
        method: 'item/completed',
        params: {
          threadId: 'thread-1',
          turnId: 'turn-1',
          item: {
            type: 'agentMessage',
            id: 'item-completed',
            text: 'completed',
          },
        },
      }),
    ];

    assert.deepEqual(events, [
      {
        kind: 'runtime-item-started',
        threadId: 'thread-1',
        turnId: 'turn-1',
        item: {
          itemId: 'item-started',
          itemKind: 'agentMessage',
          phase: null,
          memoryCitation: null,
          status: null,
          text: 'started',
          raw: {
            type: 'agentMessage',
            id: 'item-started',
            text: 'started',
          },
        },
      },
      {
        kind: 'runtime-item-completed',
        threadId: 'thread-1',
        turnId: 'turn-1',
        item: {
          itemId: 'item-completed',
          itemKind: 'agentMessage',
          phase: null,
          memoryCitation: null,
          status: null,
          text: 'completed',
          raw: {
            type: 'agentMessage',
            id: 'item-completed',
            text: 'completed',
          },
        },
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

  test('maps known non-core Codex thread and turn notifications without treating them as unknown', () => {
    const hookEvent = mapMessage({
      kind: 'notification',
      method: 'hook/started',
      params: {
        threadId: 'thread-1',
        turnId: 'turn-1',
        run: {
          id: 'hook-1',
        },
      },
    });
    const reviewEvent = mapMessage({
      kind: 'notification',
      method: 'item/autoApprovalReview/completed',
      params: {
        threadId: 'thread-1',
        turnId: 'turn-1',
        reviewId: 'review-1',
        targetItemId: 'item-1',
        review: {
          status: 'approved',
        },
        action: {
          type: 'commandExecution',
        },
      },
    });
    const realtimeEvent = mapMessage({
      kind: 'notification',
      method: 'thread/realtime/outputAudio/delta',
      params: {
        threadId: 'thread-1',
        audio: {
          itemId: 'audio-1',
          data: 'base64',
          sampleRate: 24000,
          numChannels: 1,
        },
      },
    });

    assert.deepEqual(hookEvent, {
      kind: 'runtime-codex-notification',
      semanticKind: 'hook-started',
      method: 'hook/started',
      threadId: 'thread-1',
      turnId: 'turn-1',
      itemId: null,
      data: {
        threadId: 'thread-1',
        turnId: 'turn-1',
        run: {
          id: 'hook-1',
        },
      },
    });
    assert.deepEqual(reviewEvent, {
      kind: 'runtime-codex-notification',
      semanticKind: 'auto-approval-review-completed',
      method: 'item/autoApprovalReview/completed',
      threadId: 'thread-1',
      turnId: 'turn-1',
      itemId: 'item-1',
      data: {
        threadId: 'thread-1',
        turnId: 'turn-1',
        reviewId: 'review-1',
        targetItemId: 'item-1',
        review: {
          status: 'approved',
        },
        action: {
          type: 'commandExecution',
        },
      },
    });
    assert.deepEqual(realtimeEvent, {
      kind: 'runtime-codex-notification',
      semanticKind: 'thread-realtime-output-audio-delta',
      method: 'thread/realtime/outputAudio/delta',
      threadId: 'thread-1',
      turnId: null,
      itemId: 'audio-1',
      data: {
        threadId: 'thread-1',
        audio: {
          itemId: 'audio-1',
          data: 'base64',
          sampleRate: 24000,
          numChannels: 1,
        },
      },
    });
  });

  test('maps every known shallow v2 notification without treating it as unknown', () => {
    const knownNotifications = [
      ['command/exec/outputDelta', 'command-exec-output-delta', { processId: 'proc-1', stream: 'stdout', deltaBase64: 'b2s=', capReached: false }],
      ['skills/changed', 'skills-changed', {}],
      ['mcpServer/oauthLogin/completed', 'mcp-server-oauth-login-completed', { name: 'github', success: true }],
      ['mcpServer/startupStatus/updated', 'mcp-server-status-updated', { name: 'github', status: 'ready', error: null }],
      ['account/updated', 'account-updated', { authMode: 'chatgpt', planType: 'pro' }],
      ['account/rateLimits/updated', 'account-rate-limits-updated', { rateLimits: { primary: null } }],
      ['app/list/updated', 'app-list-updated', {}],
      ['externalAgentConfig/import/completed', 'external-agent-config-import-completed', { success: true }],
      ['fs/changed', 'fs-changed', { watchId: 'watch-1', changes: [] }],
      ['guardianWarning', 'guardian-warning', { message: 'guardian warning' }],
      ['deprecationNotice', 'deprecation-notice', { message: 'deprecated' }],
      ['configWarning', 'config-warning', { message: 'config warning' }],
      ['fuzzyFileSearch/sessionUpdated', 'fuzzy-file-search-session-updated', { sessionId: 'search-1' }],
      ['fuzzyFileSearch/sessionCompleted', 'fuzzy-file-search-session-completed', { sessionId: 'search-1' }],
      ['windowsSandbox/setupCompleted', 'windows-sandbox-setup-completed', { mode: 'unelevated', success: true, error: null }],
      ['account/login/completed', 'account-login-completed', { loginId: 'login-1', success: true }],
    ] as const;
    const testLogger = createTestLogger();

    const events = knownNotifications.map(([method, _semanticKind, params]) =>
      mapMessage(
        {
          kind: 'notification',
          method,
          params,
        },
        testLogger,
      ),
    );

    assert.deepEqual(
      events.map(event => event && event.kind === 'runtime-codex-notification' ? event.semanticKind : null),
      knownNotifications.map(([, semanticKind]) => semanticKind),
    );
    assert.deepEqual(testLogger.warnings, []);
  });

  test('extracts text from rich item lifecycle notifications consistently with history parsing', () => {
    const event = mapMessage({
      kind: 'notification',
      method: 'item/started',
      params: {
        threadId: 'thread-1',
        turnId: 'turn-1',
        item: {
          type: 'userMessage',
          id: 'item-1',
          content: [
            {
              type: 'text',
              text: 'Hello',
              text_elements: [],
            },
            {
              type: 'mention',
              name: 'design',
              path: 'app://figma/file',
            },
          ],
        },
      },
    });

    assert.deepEqual(event, {
      kind: 'runtime-item-started',
      threadId: 'thread-1',
      turnId: 'turn-1',
      item: {
        itemId: 'item-1',
        itemKind: 'userMessage',
        status: null,
        text: 'Hello\n\n[mention: design]',
        raw: {
          type: 'userMessage',
          id: 'item-1',
          content: [
            {
              type: 'text',
              text: 'Hello',
              text_elements: [],
            },
            {
              type: 'mention',
              name: 'design',
              path: 'app://figma/file',
            },
          ],
        },
        content: [
          {
            type: 'text',
            text: 'Hello',
            text_elements: [],
          },
          {
            type: 'mention',
            name: 'design',
            path: 'app://figma/file',
          },
        ],
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
        error instanceof CodexProtocolError && error.message === 'Unsupported Codex turn status at Codex turn/completed turn.status: cancelled',
    );
  });
});
