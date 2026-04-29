import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { RuntimeSandboxMode, RuntimeSettings, StartRuntimeTurnCommand } from '../../../ports/index.js';
import { CodexProtocolError } from '../runtime/codex-runtime-error.js';
import { mapRuntimeCommandToCodexRequest } from './map-runtime-command.js';

const fullSettings: RuntimeSettings = {
  model: 'gpt-5.4',
  reasoningEffort: 'high',
  approvalPolicy: 'never',
  sandboxMode: 'workspace-write',
  promptOverride: 'code-review',
};

describe('mapRuntimeCommandToCodexRequest', () => {
  test('maps start-thread into the Codex thread/start request without leaking null fields', () => {
    const request = mapRuntimeCommandToCodexRequest(
      {
        kind: 'start-thread',
        workspace: 'D:/workspaces/project',
        runtimeSettings: fullSettings,
        baseInstructions: null,
      },
      {
        dynamicTools: [{ name: 'browser', enabled: true }],
      },
    );

    assert.deepEqual(request, {
      method: 'thread/start',
      params: {
        cwd: 'D:/workspaces/project',
        model: 'gpt-5.4',
        approvalPolicy: 'never',
        sandbox: 'workspace-write',
        config: {
          model_reasoning_effort: 'high',
          prompt_override: 'code-review',
        },
        dynamicTools: [{ name: 'browser', enabled: true }],
        persistExtendedHistory: true,
      },
    });
  });

  test('maps resume-thread into the Codex thread/resume request', () => {
    const request = mapRuntimeCommandToCodexRequest(
      {
        kind: 'resume-thread',
        threadId: 'thread-1',
        workspace: '/workspace',
        runtimeSettings: null,
        baseInstructions: 'Use concise answers.',
      },
      {
        dynamicTools: [],
      },
    );

    assert.deepEqual(request, {
      method: 'thread/resume',
      params: {
        threadId: 'thread-1',
        cwd: '/workspace',
        baseInstructions: 'Use concise answers.',
        persistExtendedHistory: true,
      },
    });
  });

  test('maps list-threads into the Codex thread/list request', () => {
    const request = mapRuntimeCommandToCodexRequest(
      {
        kind: 'list-threads',
        workspace: '/workspace',
        limit: 20,
        archived: false,
      },
      {
        dynamicTools: [],
      },
    );

    assert.deepEqual(request, {
      method: 'thread/list',
      params: {
        cwd: '/workspace',
        limit: 20,
        archived: false,
      },
    });
  });

  test('maps start-turn text and image content into Codex turn input', () => {
    const request = mapRuntimeCommandToCodexRequest(
      {
        kind: 'start-turn',
        threadId: 'thread-1',
        message: 'Describe this image',
        content: [
          { kind: 'text', text: 'Describe this image' },
          { kind: 'image', imagePath: 'D:/tmp/image.png' },
        ],
        runtimeSettings: fullSettings,
      },
      {
        dynamicTools: [],
      },
    );

    assert.deepEqual(request, {
      method: 'turn/start',
      params: {
        threadId: 'thread-1',
        input: [
          {
            type: 'text',
            text: 'Describe this image',
            text_elements: [],
          },
          {
            type: 'image',
            path: 'D:/tmp/image.png',
          },
        ],
        model: 'gpt-5.4',
        effort: 'high',
        approvalPolicy: 'never',
        sandboxPolicy: {
          type: 'workspaceWrite',
        },
      },
    });
  });

  test('maps empty start-turn content to a text input using the message fallback', () => {
    const request = mapRuntimeCommandToCodexRequest(
      {
        kind: 'start-turn',
        threadId: 'thread-1',
        message: 'Hello',
        content: [],
        runtimeSettings: null,
      },
      {
        dynamicTools: [],
      },
    );

    assert.deepEqual(request, {
      method: 'turn/start',
      params: {
        threadId: 'thread-1',
        input: [
          {
            type: 'text',
            text: 'Hello',
            text_elements: [],
          },
        ],
      },
    });
  });

  test('maps interrupt-turn without sending a null turn id', () => {
    const request = mapRuntimeCommandToCodexRequest(
      {
        kind: 'interrupt-turn',
        threadId: 'thread-1',
        turnId: null,
      },
      {
        dynamicTools: [],
      },
    );

    assert.deepEqual(request, {
      method: 'turn/interrupt',
      params: {
        threadId: 'thread-1',
      },
    });
  });

  test('rejects corrupted runtime sandbox mode values before they reach Codex', () => {
    const command: StartRuntimeTurnCommand = {
      kind: 'start-turn',
      threadId: 'thread-1',
      message: 'Hello',
      content: [],
      runtimeSettings: {
        ...fullSettings,
        sandboxMode: 'networked' as unknown as RuntimeSandboxMode,
      },
    };

    assert.throws(
      () => mapRuntimeCommandToCodexRequest(command, { dynamicTools: [] }),
      (error: unknown) =>
        error instanceof CodexProtocolError &&
        error.message === 'Unsupported runtime sandbox mode: networked',
    );
  });
});
