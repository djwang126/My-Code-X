import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDefaultRuntimePreferences,
  createForkThreadParams,
  createInitializeParams,
  mapCodexConfigToRuntimePreferences,
  mapCodexRuntimeOptions,
  createResumeThreadParams,
  createStartThreadParams,
  createStartTurnParams,
  mapCodexNotificationToRuntimeEvent,
} from './codex-gateway-protocol.js';

test('mapCodexNotificationToRuntimeEvent maps raw Codex error notifications', () => {
  assert.deepEqual(
    mapCodexNotificationToRuntimeEvent('error', {
      threadId: 'thread-1',
      turnId: 'turn-1',
      willRetry: true,
      error: {
        message: 'codex app-server stdout unavailable',
        codexErrorInfo: { httpConnectionFailed: { httpStatusCode: 502 } },
        additionalDetails: 'upstream timeout',
      },
    }),
    {
      type: 'error',
      threadId: 'thread-1',
      turnId: 'turn-1',
      error: {
        message: 'codex app-server stdout unavailable',
        codexErrorInfo: { httpConnectionFailed: { httpStatusCode: 502 } },
        additionalDetails: 'upstream timeout',
        httpStatusCode: 502,
        willRetry: true,
        threadId: 'thread-1',
        turnId: 'turn-1',
        presentationScope: 'conversation',
        source: 'error_notification',
        raw: {
          message: 'codex app-server stdout unavailable',
          codexErrorInfo: { httpConnectionFailed: { httpStatusCode: 502 } },
          additionalDetails: 'upstream timeout',
        },
      },
    },
  );
});

test('mapCodexNotificationToRuntimeEvent maps turn completion failures as conversation-scoped errors', () => {
  assert.deepEqual(
    mapCodexNotificationToRuntimeEvent('turn/completed', {
      threadId: 'thread-1',
      turn: {
        id: 'turn-1',
        status: 'failed',
        error: {
          message: 'testfail',
          codexErrorInfo: null,
          additionalDetails: null,
        },
      },
    }),
    {
      type: 'turn_completed',
      threadId: 'thread-1',
      turnId: 'turn-1',
      turn: {
        id: 'turn-1',
        status: 'failed',
        error: {
          message: 'testfail',
          codexErrorInfo: null,
          additionalDetails: null,
          httpStatusCode: null,
          willRetry: null,
          threadId: 'thread-1',
          turnId: 'turn-1',
          presentationScope: 'conversation',
          source: 'turn_completed',
          raw: {
            message: 'testfail',
            codexErrorInfo: null,
            additionalDetails: null,
          },
        },
      },
    },
  );
});

test('mapCodexNotificationToRuntimeEvent maps realtime thread failures as shared errors', () => {
  assert.deepEqual(
    mapCodexNotificationToRuntimeEvent('thread/realtime/error', {
      threadId: 'thread-1',
      message: 'stream dropped',
    }),
    {
      type: 'error',
      threadId: 'thread-1',
      turnId: null,
      error: {
        message: 'stream dropped',
        codexErrorInfo: null,
        additionalDetails: null,
        httpStatusCode: null,
        willRetry: null,
        threadId: 'thread-1',
        turnId: null,
        presentationScope: 'shared',
        source: 'thread_realtime_error',
        raw: {
          message: 'stream dropped',
        },
      },
    },
  );
});

test('createStartThreadParams only includes dynamic tools when explicitly configured', () => {
  assert.deepEqual(createStartThreadParams({ cwd: 'D:/workspace/example-app' }), {
    cwd: 'D:/workspace/example-app',
    persistExtendedHistory: true,
  });

  assert.deepEqual(
    createStartThreadParams({
      cwd: 'D:/workspace/example-app',
      dynamicToolSpecs: [
        {
          name: 'lookup_ticket',
          description: 'Fetch a ticket by id',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
            },
            required: ['id'],
          },
          deferLoading: true,
        },
      ],
    }),
    {
      cwd: 'D:/workspace/example-app',
      persistExtendedHistory: true,
      dynamicTools: [
        {
          name: 'lookup_ticket',
          description: 'Fetch a ticket by id',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
            },
            required: ['id'],
          },
          deferLoading: true,
        },
      ],
    },
  );
});

test('createStartThreadParams and createStartTurnParams do not inject approval or sandbox defaults', () => {
  assert.deepEqual(
    createStartThreadParams({
      cwd: 'D:/workspace/example-app',
      runtimeSettings: {
        model: 'gpt-5.4',
      },
    }),
    {
      cwd: 'D:/workspace/example-app',
      model: 'gpt-5.4',
      persistExtendedHistory: true,
    },
  );

  assert.deepEqual(
    createStartTurnParams({
      threadId: 'thread-1',
      text: 'Use stricter settings',
      cwd: 'D:/workspace/example-app',
      runtimeSettings: {
        model: 'gpt-5.4',
      },
    }),
    {
      threadId: 'thread-1',
      input: [{ type: 'text', text: 'Use stricter settings', text_elements: [] }],
      cwd: 'D:/workspace/example-app',
      model: 'gpt-5.4',
    },
  );
});

test('createInitializeParams identifies the client as Codex VS Code', () => {
  assert.deepEqual(createInitializeParams(), {
    clientInfo: {
      name: 'codex_vscode',
      title: 'Codex VS Code Extension',
      version: '0.1.0',
    },
    capabilities: {
      experimentalApi: true,
    },
  });
});

test('createDefaultRuntimePreferences uses the built-in runtime defaults', () => {
  assert.deepEqual(createDefaultRuntimePreferences(), {
    model: 'gpt-5.4',
    reasoningEffort: 'medium',
    reasoningSummary: null,
    approvalPolicy: 'never',
    sandboxMode: 'danger-full-access',
  });
});

test('createStartThreadParams includes explicit thread-scoped model config overrides', () => {
  assert.deepEqual(
    createStartThreadParams({
      cwd: 'D:/workspace/example-app',
      runtimeSettings: {
        modelContextWindow: 200_000,
        modelAutoCompactTokenLimit: 150_000,
      },
    }),
    {
      cwd: 'D:/workspace/example-app',
      config: {
        model_context_window: 200_000,
        model_auto_compact_token_limit: 150_000,
      },
      persistExtendedHistory: true,
    },
  );

  assert.deepEqual(
    createStartTurnParams({
      threadId: 'thread-1',
      text: 'Use stricter settings',
      cwd: 'D:/workspace/example-app',
      runtimeSettings: {
        modelContextWindow: 200_000,
        modelAutoCompactTokenLimit: 150_000,
      },
    }),
    {
      threadId: 'thread-1',
      input: [{ type: 'text', text: 'Use stricter settings', text_elements: [] }],
      cwd: 'D:/workspace/example-app',
    },
  );
});

test('createStartThreadParams and createStartTurnParams apply explicit runtime settings overrides', () => {
  assert.deepEqual(
    createStartThreadParams({
      cwd: 'D:/workspace/example-app',
      runtimeSettings: {
        model: 'gpt-5.4',
        approvalPolicy: 'on-request',
        sandboxMode: 'workspace-write',
      },
    }),
    {
      cwd: 'D:/workspace/example-app',
      model: 'gpt-5.4',
      approvalPolicy: 'on-request',
      sandbox: 'workspace-write',
      persistExtendedHistory: true,
    },
  );

  assert.deepEqual(
    createStartTurnParams({
      threadId: 'thread-1',
      text: 'Use stricter settings',
      cwd: 'D:/workspace/example-app',
      runtimeSettings: {
        model: 'gpt-5.4',
        reasoningSummary: 'concise',
        reasoningEffort: 'high',
        approvalPolicy: 'on-request',
        sandboxMode: 'workspace-write',
      },
    }),
    {
      threadId: 'thread-1',
      input: [{ type: 'text', text: 'Use stricter settings', text_elements: [] }],
      cwd: 'D:/workspace/example-app',
      model: 'gpt-5.4',
      effort: 'high',
      summary: 'concise',
      approvalPolicy: 'on-request',
      sandboxPolicy: { type: 'workspaceWrite' },
    },
  );
});

test('createStartThreadParams and createResumeThreadParams preserve empty base instructions overrides', () => {
  assert.deepEqual(
    createStartThreadParams({
      cwd: 'D:/workspace/example-app',
      baseInstructions: '',
    }),
    {
      cwd: 'D:/workspace/example-app',
      baseInstructions: '',
      persistExtendedHistory: true,
    },
  );

  assert.deepEqual(
    createResumeThreadParams({
      threadId: 'thread-1',
      cwd: 'D:/workspace/example-app',
      baseInstructions: '',
    }),
    {
      threadId: 'thread-1',
      cwd: 'D:/workspace/example-app',
      persistExtendedHistory: true,
      baseInstructions: '',
    },
  );
});

test('createStartThreadParams and createResumeThreadParams pass through explicit base instructions overrides', () => {
  assert.deepEqual(
    createStartThreadParams({
      cwd: 'D:/workspace/example-app',
      baseInstructions: 'You are a cute cat',
    }),
    {
      cwd: 'D:/workspace/example-app',
      baseInstructions: 'You are a cute cat',
      persistExtendedHistory: true,
    },
  );

  assert.deepEqual(
    createResumeThreadParams({
      threadId: 'thread-1',
      cwd: 'D:/workspace/example-app',
      baseInstructions: 'You are a supportive teammate',
    }),
    {
      threadId: 'thread-1',
      cwd: 'D:/workspace/example-app',
      persistExtendedHistory: true,
      baseInstructions: 'You are a supportive teammate',
    },
  );
});

test('createForkThreadParams reuses the same thread request base as start and resume', () => {
  assert.deepEqual(
    createForkThreadParams({
      threadId: 'thread-1',
      cwd: 'D:/workspace/example-app',
      runtimeSettings: {
        model: 'gpt-5.4',
        approvalPolicy: 'on-request',
        sandboxMode: 'workspace-write',
        modelContextWindow: 200_000,
        modelAutoCompactTokenLimit: 150_000,
      },
      baseInstructions: 'You are a supportive teammate',
    }),
    {
      threadId: 'thread-1',
      cwd: 'D:/workspace/example-app',
      model: 'gpt-5.4',
      approvalPolicy: 'on-request',
      sandbox: 'workspace-write',
      config: {
        model_context_window: 200_000,
        model_auto_compact_token_limit: 150_000,
      },
      persistExtendedHistory: true,
      baseInstructions: 'You are a supportive teammate',
    },
  );
});

test('mapCodexConfigToRuntimePreferences includes current thread-scoped model config values', () => {
  assert.deepEqual(
    mapCodexConfigToRuntimePreferences({
      config: {
        model: 'gpt-5.4',
        modelReasoningEffort: 'high',
        modelReasoningSummary: 'detailed',
        approvalPolicy: 'on-request',
        sandboxMode: 'workspace-write',
        model_context_window: 200_000,
        model_auto_compact_token_limit: 150_000,
      },
    }),
    {
      model: 'gpt-5.4',
      reasoningEffort: 'high',
      reasoningSummary: 'detailed',
      approvalPolicy: 'on-request',
      sandboxMode: 'workspace-write',
      modelContextWindow: 200_000,
      modelAutoCompactTokenLimit: 150_000,
    },
  );
});

test('mapCodexConfigToRuntimePreferences reads snake_case fields from real config/read responses', () => {
  assert.deepEqual(
    mapCodexConfigToRuntimePreferences({
      config: {
        model: 'gpt-5.4',
        model_reasoning_effort: 'high',
        model_reasoning_summary: 'detailed',
        approval_policy: 'on-request',
        sandbox_mode: 'workspace-write',
        model_context_window: 200_000,
        model_auto_compact_token_limit: 150_000,
      },
    }),
    {
      model: 'gpt-5.4',
      reasoningEffort: 'high',
      reasoningSummary: 'detailed',
      approvalPolicy: 'on-request',
      sandboxMode: 'workspace-write',
      modelContextWindow: 200_000,
      modelAutoCompactTokenLimit: 150_000,
    },
  );
});

test('runtime metadata helpers avoid seeding hardcoded preferences when config/read is unavailable', () => {
  assert.equal(mapCodexConfigToRuntimePreferences(null), null);
  assert.equal(mapCodexRuntimeOptions(), null);
});

test('mapCodexRuntimeOptions exposes reasoning summary choices for the settings UI', () => {
  assert.deepEqual(mapCodexRuntimeOptions({ fallbackPreferences: { model: 'gpt-5.4' } }).reasoningSummaryOptions, [
    {
      value: 'auto',
      label: 'Auto',
      description: 'Use the model default reasoning summary behavior.',
    },
    {
      value: 'concise',
      label: 'Concise',
      description: 'Show a short reasoning summary.',
    },
    {
      value: 'detailed',
      label: 'Detailed',
      description: 'Show a more detailed reasoning summary.',
    },
    {
      value: 'none',
      label: 'None',
      description: 'Do not request a reasoning summary.',
    },
  ]);
});

test('mapCodexRuntimeOptions exposes collaboration mode presets for the UI', () => {
  assert.deepEqual(
    mapCodexRuntimeOptions({
      fallbackPreferences: { model: 'gpt-5.4' },
      collaborationModeListResponse: {
        data: [
          {
            name: 'Plan',
            mode: 'plan',
            model: null,
            reasoning_effort: 'medium',
          },
          {
            name: 'Default',
            mode: 'default',
            model: null,
            reasoning_effort: null,
          },
        ],
      },
    }).collaborationModes,
    [
      {
        kind: 'plan',
        label: 'Plan',
        model: null,
        reasoningEffort: 'medium',
      },
      {
        kind: 'default',
        label: 'Default',
        model: null,
        reasoningEffort: null,
      },
    ],
  );
});

test('mapCodexRuntimeOptions exposes prompt override presets for the settings UI', () => {
  assert.deepEqual(
    mapCodexRuntimeOptions({
      fallbackPreferences: { model: 'gpt-5.4' },
      promptOverrideOptions: [
        { value: 'normal', label: 'normal', description: '' },
        { value: 'cat', label: 'cat', description: '' },
      ],
    }).promptOverrides,
    [
      { value: 'normal', label: 'normal', description: '' },
      { value: 'cat', label: 'cat', description: '' },
    ],
  );
});

test('createStartTurnParams attaches the selected collaboration mode preset using the current runtime settings as a base', () => {
  assert.deepEqual(
    createStartTurnParams({
      threadId: 'thread-1',
      text: 'Inspect the bug first',
      cwd: 'D:/workspace/example-app',
      runtimeSettings: {
        model: 'gpt-5.4',
        reasoningEffort: 'high',
      },
      collaborationMode: {
        kind: 'plan',
        label: 'Plan',
        model: null,
        reasoningEffort: 'medium',
      },
    }),
    {
      threadId: 'thread-1',
      input: [{ type: 'text', text: 'Inspect the bug first', text_elements: [] }],
      cwd: 'D:/workspace/example-app',
      model: 'gpt-5.4',
      effort: 'high',
      collaborationMode: {
        mode: 'plan',
        settings: {
          model: 'gpt-5.4',
          reasoning_effort: 'medium',
          developer_instructions: null,
        },
      },
    },
  );
});
