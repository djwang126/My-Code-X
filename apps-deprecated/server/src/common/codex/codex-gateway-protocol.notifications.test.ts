import test from 'node:test';
import assert from 'node:assert/strict';

import {
  mapCodexNotificationToRuntimeEvent,
  mapCodexServerRequestToRuntimeEvent,
} from './codex-gateway-protocol.js';

test('mapCodexServerRequestToRuntimeEvent normalizes approvals and interactive request flows', () => {
  assert.deepEqual(
    mapCodexServerRequestToRuntimeEvent('61', 'item/commandExecution/requestApproval', {
      threadId: 'thread-1',
      turnId: 'turn-1',
      itemId: 'cmd-1',
      approvalId: 'approval-1',
      command: 'npm test',
      cwd: 'D:/workspace/example-app',
      reason: 'Run the verification suite',
      commandActions: [{ label: 'Run tests', action: 'run' }],
      availableDecisions: ['accept', 'decline'],
      networkApprovalContext: { kind: 'network', host: 'example.com' },
    }),
    {
      type: 'pending_request_updated',
      threadId: 'thread-1',
      request: {
        id: '61',
        method: 'item/commandExecution/requestApproval',
        kind: 'command_approval',
        threadId: 'thread-1',
        turnId: 'turn-1',
        itemId: 'cmd-1',
        approvalId: 'approval-1',
        title: 'Approve command execution',
        prompt: 'npm test',
        command: 'npm test',
        cwd: 'D:/workspace/example-app',
        reason: 'Run the verification suite',
        commandActions: [{ label: 'Run tests', action: 'run' }],
        availableDecisions: ['accept', 'decline'],
        networkApprovalContext: { kind: 'network', host: 'example.com' },
        submitState: 'idle',
        raw: {
          threadId: 'thread-1',
          turnId: 'turn-1',
          itemId: 'cmd-1',
          approvalId: 'approval-1',
          command: 'npm test',
          cwd: 'D:/workspace/example-app',
          reason: 'Run the verification suite',
          commandActions: [{ label: 'Run tests', action: 'run' }],
          availableDecisions: ['accept', 'decline'],
          networkApprovalContext: { kind: 'network', host: 'example.com' },
        },
      },
    },
  );

  assert.deepEqual(
    mapCodexServerRequestToRuntimeEvent('62', 'item/tool/requestUserInput', {
      threadId: 'thread-1',
      turnId: 'turn-1',
      itemId: 'ask-1',
      questions: [
        {
          id: 'environment',
          header: 'Env',
          question: 'Which environment should I use?',
          options: [
            { label: 'Staging', description: 'Use staging' },
            { label: 'Production', description: 'Use prod' },
          ],
        },
      ],
    }),
    {
      type: 'pending_request_updated',
      threadId: 'thread-1',
      request: {
        id: '62',
        method: 'item/tool/requestUserInput',
        kind: 'user_input',
        threadId: 'thread-1',
        turnId: 'turn-1',
        itemId: 'ask-1',
        title: 'Answer 1 question',
        prompt: '',
        questions: [
          {
            id: 'environment',
            header: 'Env',
            question: 'Which environment should I use?',
            options: [
              { label: 'Staging', description: 'Use staging' },
              { label: 'Production', description: 'Use prod' },
            ],
          },
        ],
        submitState: 'idle',
        raw: {
          threadId: 'thread-1',
          turnId: 'turn-1',
          itemId: 'ask-1',
          questions: [
            {
              id: 'environment',
              header: 'Env',
              question: 'Which environment should I use?',
              options: [
                { label: 'Staging', description: 'Use staging' },
                { label: 'Production', description: 'Use prod' },
              ],
            },
          ],
        },
      },
    },
  );

  assert.deepEqual(
    mapCodexServerRequestToRuntimeEvent('63', 'mcpServer/elicitation/request', {
      threadId: 'thread-1',
      turnId: 'turn-1',
      serverName: 'filesystem',
      mode: 'form',
      message: 'Which file should I open?',
      requestedSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', title: 'Path' },
        },
      },
    }),
    {
      type: 'pending_request_updated',
      threadId: 'thread-1',
      request: {
        id: '63',
        method: 'mcpServer/elicitation/request',
        kind: 'mcp_elicitation',
        threadId: 'thread-1',
        turnId: 'turn-1',
        title: 'MCP server input',
        prompt: 'Which file should I open?',
        serverName: 'filesystem',
        mode: 'form',
        requestedSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', title: 'Path' },
          },
        },
        submitState: 'idle',
        raw: {
          threadId: 'thread-1',
          turnId: 'turn-1',
          serverName: 'filesystem',
          mode: 'form',
          message: 'Which file should I open?',
          requestedSchema: {
            type: 'object',
            properties: {
              path: { type: 'string', title: 'Path' },
            },
          },
        },
      },
    },
  );

  assert.deepEqual(
    mapCodexServerRequestToRuntimeEvent('64', 'item/tool/call', {
      threadId: 'thread-1',
      turnId: 'turn-1',
      callId: 'call-1',
      tool: 'lookup_ticket',
      arguments: { id: 'ABC-123' },
    }),
    {
      type: 'pending_request_updated',
      threadId: 'thread-1',
      request: {
        id: '64',
        method: 'item/tool/call',
        kind: 'tool_call',
        threadId: 'thread-1',
        turnId: 'turn-1',
        callId: 'call-1',
        title: 'Dynamic tool call',
        prompt: 'lookup_ticket',
        tool: 'lookup_ticket',
        arguments: { id: 'ABC-123' },
        submitState: 'idle',
        raw: {
          threadId: 'thread-1',
          turnId: 'turn-1',
          callId: 'call-1',
          tool: 'lookup_ticket',
          arguments: { id: 'ABC-123' },
        },
      },
    },
  );

  assert.deepEqual(
    mapCodexServerRequestToRuntimeEvent('65', 'account/chatgptAuthTokens/refresh', {
      reason: 'unauthorized',
      previousAccountId: 'acct-9',
    }),
    {
      type: 'pending_request_updated',
      threadId: '',
      request: {
        id: '65',
        method: 'account/chatgptAuthTokens/refresh',
        kind: 'auth_refresh',
        threadId: '',
        turnId: null,
        title: 'Refresh ChatGPT authentication',
        prompt: 'Codex needs refreshed ChatGPT credentials.',
        previousAccountId: 'acct-9',
        reason: 'unauthorized',
        submitState: 'idle',
        raw: {
          reason: 'unauthorized',
          previousAccountId: 'acct-9',
        },
      },
    },
  );
});

test('mapCodexNotificationToRuntimeEvent normalizes generic started special items into timeline updates', () => {
  assert.deepEqual(
    mapCodexNotificationToRuntimeEvent('item/started', {
      threadId: 'thread-1',
      turnId: 'turn-1',
      item: {
        type: 'commandExecution',
        id: 'cmd-1',
        command: 'npm test',
        cwd: 'D:/workspace/example-app',
        status: 'inProgress',
      },
    }),
    {
      type: 'timeline_item_updated',
      threadId: 'thread-1',
      turnId: 'turn-1',
      item: {
        id: 'cmd-1',
        kind: 'special',
        itemType: 'commandExecution',
        text: 'npm test',
        state: 'streaming',
        threadId: 'thread-1',
        turnId: 'turn-1',
        status: 'inProgress',
        raw: {
          type: 'commandExecution',
          id: 'cmd-1',
          command: 'npm test',
          cwd: 'D:/workspace/example-app',
          status: 'inProgress',
        },
      },
    },
  );
});

test('mapCodexNotificationToRuntimeEvent keeps empty reasoning items visible in live timeline updates', () => {
  assert.deepEqual(
    mapCodexNotificationToRuntimeEvent('item/started', {
      threadId: 'thread-1',
      turnId: 'turn-1',
      item: {
        type: 'reasoning',
        id: 'reason-1',
        summary: [],
        content: [],
        status: 'inProgress',
      },
    }),
    {
      type: 'timeline_item_updated',
      threadId: 'thread-1',
      turnId: 'turn-1',
      item: {
        id: 'reason-1',
        kind: 'special',
        itemType: 'reasoning',
        text: '',
        state: 'streaming',
        threadId: 'thread-1',
        turnId: 'turn-1',
        status: 'inProgress',
        raw: {
          type: 'reasoning',
          id: 'reason-1',
          summary: [],
          content: [],
          status: 'inProgress',
        },
      },
    },
  );
});

test('mapCodexNotificationToRuntimeEvent maps live special-item delta notifications', () => {
  assert.deepEqual(
    mapCodexNotificationToRuntimeEvent('item/plan/delta', {
      threadId: 'thread-1',
      turnId: 'turn-1',
      itemId: 'plan-1',
      delta: 'Inspect the reducer',
    }),
    {
      type: 'timeline_item_delta',
      threadId: 'thread-1',
      turnId: 'turn-1',
      itemId: 'plan-1',
      itemType: 'plan',
      delta: 'Inspect the reducer',
    },
  );

  assert.deepEqual(
    mapCodexNotificationToRuntimeEvent('item/commandExecution/outputDelta', {
      threadId: 'thread-1',
      turnId: 'turn-1',
      itemId: 'cmd-1',
      delta: 'PASS 42 tests',
    }),
    {
      type: 'timeline_item_delta',
      threadId: 'thread-1',
      turnId: 'turn-1',
      itemId: 'cmd-1',
      itemType: 'commandExecution',
      delta: 'PASS 42 tests',
      deltaField: 'aggregatedOutput',
    },
  );

  assert.deepEqual(
    mapCodexNotificationToRuntimeEvent('item/reasoning/summaryTextDelta', {
      threadId: 'thread-1',
      turnId: 'turn-1',
      itemId: 'reason-1',
      summaryIndex: 0,
      delta: 'Need to inspect the runtime service',
    }),
    {
      type: 'timeline_item_delta',
      threadId: 'thread-1',
      turnId: 'turn-1',
      itemId: 'reason-1',
      itemType: 'reasoning',
      delta: 'Need to inspect the runtime service',
      deltaField: 'summary',
      index: 0,
    },
  );
});

test('mapCodexNotificationToRuntimeEvent ignores unknown notifications safely', () => {
  assert.equal(
    mapCodexNotificationToRuntimeEvent('future/notification/added', {
      threadId: 'thread-1',
      payload: { any: 'value' },
    }),
    null,
  );
});

test('mapCodexNotificationToRuntimeEvent maps session meta and system notice notifications', () => {
  assert.deepEqual(
    mapCodexNotificationToRuntimeEvent('thread/name/updated', {
      threadId: 'thread-1',
      threadName: 'Issue 9 work',
    }),
    {
      type: 'session_meta_updated',
      threadId: 'thread-1',
      threadName: 'Issue 9 work',
    },
  );

  assert.deepEqual(
    mapCodexNotificationToRuntimeEvent('thread/tokenUsage/updated', {
      threadId: 'thread-1',
      turnId: 'turn-1',
      tokenUsage: {
        last: {
          inputTokens: 120,
          outputTokens: 45,
          cachedInputTokens: 8,
          reasoningOutputTokens: 12,
          totalTokens: 177,
        },
        total: {
          inputTokens: 500,
          outputTokens: 240,
          cachedInputTokens: 32,
          reasoningOutputTokens: 60,
          totalTokens: 832,
        },
        modelContextWindow: 200000,
      },
    }),
    {
      type: 'session_meta_updated',
      threadId: 'thread-1',
      tokenUsageText: 'last: input 120 · output 45 · cached 8 · reasoning 12 · total 177 | total: input 500 · output 240 · cached 32 · reasoning 60 · total 832',
    },
  );

  assert.deepEqual(
    mapCodexNotificationToRuntimeEvent('thread/status/changed', {
      threadId: 'thread-1',
      status: {
        type: 'loaded',
        activeFlags: ['waitingOnUserInput'],
      },
    }),
    {
      type: 'session_meta_updated',
      threadId: 'thread-1',
      threadStatus: {
        type: 'loaded',
        activeFlags: ['waitingOnUserInput'],
      },
      threadStatusText: 'loaded (waitingOnUserInput)',
    },
  );

  assert.deepEqual(
    mapCodexNotificationToRuntimeEvent('thread/started', {
      thread: {
        id: 'thread-1',
        name: 'Issue 9 work',
        status: 'active',
      },
    }),
    {
      type: 'session_meta_updated',
      threadId: 'thread-1',
      threadName: 'Issue 9 work',
      threadStatus: 'active',
      threadStatusText: 'active',
    },
  );

  assert.deepEqual(
    mapCodexNotificationToRuntimeEvent('thread/archived', {
      threadId: 'thread-1',
    }),
    {
      type: 'session_meta_updated',
      threadId: 'thread-1',
      threadStatus: 'archived',
      threadStatusText: 'archived',
    },
  );

  assert.deepEqual(
    mapCodexNotificationToRuntimeEvent('thread/unarchived', {
      threadId: 'thread-1',
    }),
    {
      type: 'session_meta_updated',
      threadId: 'thread-1',
      threadStatus: 'active',
      threadStatusText: 'active',
    },
  );

  assert.deepEqual(
    mapCodexNotificationToRuntimeEvent('thread/closed', {
      threadId: 'thread-1',
    }),
    {
      type: 'session_meta_updated',
      threadId: 'thread-1',
      threadStatus: 'closed',
      threadStatusText: 'closed',
    },
  );

  assert.deepEqual(
    mapCodexNotificationToRuntimeEvent('configWarning', {
      threadId: 'thread-1',
      message: 'Sandbox will be tightened soon',
    }),
    {
      type: 'system_notice',
      threadId: 'thread-1',
      notice: {
        id: 'configWarning:latest',
        level: 'warning',
        title: 'Config warning',
        text: 'Sandbox will be tightened soon',
        raw: {
          threadId: 'thread-1',
          message: 'Sandbox will be tightened soon',
        },
      },
    },
  );

  assert.deepEqual(
    mapCodexNotificationToRuntimeEvent('thread/compacted', {
      threadId: 'thread-1',
    }),
    {
      type: 'system_notice',
      threadId: 'thread-1',
      notice: {
        id: 'thread/compacted:latest',
        level: 'info',
        title: 'thread compacted',
        text: 'thread compacted',
        raw: {
          threadId: 'thread-1',
        },
      },
    },
  );

  assert.deepEqual(
    mapCodexNotificationToRuntimeEvent('turn/plan/updated', {
      threadId: 'thread-1',
      turnId: 'turn-9',
      explanation: 'Finish the notice cleanup',
      plan: [{ step: 'Remove transcript notice cards', status: 'inProgress' }],
    }),
    {
      type: 'system_notice',
      threadId: 'thread-1',
      notice: {
        id: 'turn/plan/updated:turn-9',
        level: 'info',
        title: 'Todo list updated',
        text: 'Finish the notice cleanup · inProgress: Remove transcript notice cards',
        raw: {
          threadId: 'thread-1',
          turnId: 'turn-9',
          explanation: 'Finish the notice cleanup',
          plan: [{ step: 'Remove transcript notice cards', status: 'inProgress' }],
        },
      },
    },
  );

  assert.deepEqual(
    mapCodexNotificationToRuntimeEvent('serverRequest/resolved', {
      threadId: 'thread-1',
      requestId: 'req-9',
    }),
    {
      type: 'pending_request_resolved',
      threadId: 'thread-1',
      requestId: 'req-9',
      notice: {
        id: 'serverRequest/resolved:req-9',
        level: 'info',
        title: 'Request resolved',
        text: 'Resolved request req-9',
        raw: {
          threadId: 'thread-1',
          requestId: 'req-9',
        },
      },
    },
  );
});

test('mapCodexNotificationToRuntimeEvent only exposes the curated notice allowlist', () => {
  assert.equal(
    mapCodexNotificationToRuntimeEvent('item/autoApprovalReview/started', {
      threadId: 'thread-1',
      targetItemId: 'item-1',
      review: { status: 'started' },
    }),
    null,
  );

  assert.equal(
    mapCodexNotificationToRuntimeEvent('item/autoApprovalReview/completed', {
      threadId: 'thread-1',
      targetItemId: 'item-1',
      review: { status: 'completed' },
    }),
    null,
  );

  assert.equal(
    mapCodexNotificationToRuntimeEvent('hook/started', {
      threadId: 'thread-1',
      message: 'hook started',
    }),
    null,
  );

  assert.equal(
    mapCodexNotificationToRuntimeEvent('hook/completed', {
      threadId: 'thread-1',
      message: 'hook completed',
    }),
    null,
  );

  assert.equal(
    mapCodexNotificationToRuntimeEvent('turn/diff/updated', {
      threadId: 'thread-1',
      turnId: 'turn-1',
      diff: 'M  src/app.tsx',
    }),
    null,
  );

  assert.equal(
    mapCodexNotificationToRuntimeEvent('model/rerouted', {
      threadId: 'thread-1',
      turnId: 'turn-1',
      fromModel: 'gpt-5.1-codex',
      toModel: 'gpt-5.4',
    }),
    null,
  );

  assert.equal(
    mapCodexNotificationToRuntimeEvent('account/rateLimits/updated', {
      threadId: 'thread-1',
      status: 'limited',
    }),
    null,
  );

  assert.equal(
    mapCodexNotificationToRuntimeEvent('account/login/completed', {
      threadId: 'thread-1',
      status: 'ok',
    }),
    null,
  );

  assert.equal(
    mapCodexNotificationToRuntimeEvent('windowsSandbox/setupCompleted', {
      threadId: 'thread-1',
      mode: 'workspace-write',
      success: true,
    }),
    null,
  );

  assert.equal(
    mapCodexNotificationToRuntimeEvent('mcpServer/startupStatus/updated', {
      threadId: 'thread-1',
      name: 'filesystem',
      status: 'failed',
      error: 'boom',
    }),
    null,
  );

  assert.equal(
    mapCodexNotificationToRuntimeEvent('mcpServer/oauthLogin/completed', {
      threadId: 'thread-1',
      name: 'filesystem',
      status: 'ok',
    }),
    null,
  );

  assert.equal(
    mapCodexNotificationToRuntimeEvent('rawResponseItem/completed', {
      threadId: 'thread-1',
      item: { id: 'raw-1', type: 'debugPayload' },
    }),
    null,
  );
});

test('mapCodexNotificationToRuntimeEvent keeps curated notices readable with sparse params', () => {
  assert.deepEqual(
    mapCodexNotificationToRuntimeEvent('account/updated', {
      threadId: 'thread-1',
    }),
    {
      type: 'system_notice',
      threadId: 'thread-1',
      notice: {
        id: 'account/updated:latest',
        level: 'info',
        title: 'account updated',
        text: 'account updated',
        raw: {
          threadId: 'thread-1',
        },
      },
    },
  );

  assert.deepEqual(
    mapCodexNotificationToRuntimeEvent('fs/changed', {
      threadId: 'thread-1',
      path: 'D:/workspace/example-app/src/App.tsx',
    }),
    {
      type: 'system_notice',
      threadId: 'thread-1',
      notice: {
        id: 'fs/changed:latest',
        level: 'info',
        title: 'fs changed',
        text: 'fs changed',
        raw: {
          threadId: 'thread-1',
          path: 'D:/workspace/example-app/src/App.tsx',
        },
      },
    },
  );
});

test('mapCodexNotificationToRuntimeEvent maps the rest of the curated notice allowlist', () => {
  assert.deepEqual(
    mapCodexNotificationToRuntimeEvent('deprecationNotice', {
      threadId: 'thread-1',
      message: 'Legacy config keys will be removed soon',
    }),
    {
      type: 'system_notice',
      threadId: 'thread-1',
      notice: {
        id: 'deprecationNotice:latest',
        level: 'warning',
        title: 'Deprecation notice',
        text: 'Legacy config keys will be removed soon',
        raw: {
          threadId: 'thread-1',
          message: 'Legacy config keys will be removed soon',
        },
      },
    },
  );

  assert.deepEqual(
    mapCodexNotificationToRuntimeEvent('windows/worldWritableWarning', {
      threadId: 'thread-1',
      path: 'D:/workspace/example-app',
    }),
    {
      type: 'system_notice',
      threadId: 'thread-1',
      notice: {
        id: 'windows/worldWritableWarning:latest',
        level: 'warning',
        title: 'World-writable warning',
        text: 'D:/workspace/example-app',
        raw: {
          threadId: 'thread-1',
          path: 'D:/workspace/example-app',
        },
      },
    },
  );

  assert.deepEqual(
    mapCodexNotificationToRuntimeEvent('skills/changed', {
      threadId: 'thread-1',
      name: 'playwright',
    }),
    {
      type: 'system_notice',
      threadId: 'thread-1',
      notice: {
        id: 'skills/changed:playwright',
        level: 'info',
        title: 'skills changed',
        text: 'playwright',
        raw: {
          threadId: 'thread-1',
          name: 'playwright',
        },
      },
    },
  );

  assert.deepEqual(
    mapCodexNotificationToRuntimeEvent('app/list/updated', {
      threadId: 'thread-1',
      status: 'reloaded',
    }),
    {
      type: 'system_notice',
      threadId: 'thread-1',
      notice: {
        id: 'app/list/updated:latest',
        level: 'info',
        title: 'app list updated',
        text: 'reloaded',
        raw: {
          threadId: 'thread-1',
          status: 'reloaded',
        },
      },
    },
  );
});
