import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { RuntimeSandboxMode, RuntimeSettings, StartRuntimeTurnCommand } from '../../../../ports/index.js';
import { CodexProtocolError } from '../../errors/codex-runtime-error.js';
import { encodeRuntimeCommandToCodexRequest } from './encode-runtime-command.js';

const fullSettings: RuntimeSettings = {
  model: 'gpt-5.4',
  reasoningEffort: 'high',
  approvalPolicy: 'never',
  sandboxMode: 'workspace-write',
  promptOverride: 'code-review',
};

describe('encodeRuntimeCommandToCodexRequest', () => {
  test('encodes start-thread into the Codex thread/start request without leaking null fields', () => {
    const request = encodeRuntimeCommandToCodexRequest(
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

  test('encodes resume-thread into the Codex thread/resume request', () => {
    const request = encodeRuntimeCommandToCodexRequest(
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

  test('encodes list-threads into the Codex thread/list request', () => {
    const request = encodeRuntimeCommandToCodexRequest(
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

  test('encodes start-turn text and image content into Codex turn input', () => {
    const request = encodeRuntimeCommandToCodexRequest(
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
            type: 'localImage',
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

  test('encodes empty start-turn content to a text input using the message fallback', () => {
    const request = encodeRuntimeCommandToCodexRequest(
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

  test('encodes interrupt-turn without sending a null turn id', () => {
    const request = encodeRuntimeCommandToCodexRequest(
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
        turnId: '',
      },
    });
  });

  test('encodes fork, read, turns list, rollback, and steer thread-turn commands', () => {
    const fork = encodeRuntimeCommandToCodexRequest(
      {
        kind: 'fork-thread',
        threadId: 'thread-1',
        workspace: '/workspace',
        runtimeSettings: null,
        baseInstructions: null,
        path: '/rollout.jsonl',
        ephemeral: true,
      },
      { dynamicTools: [] },
    );
    const read = encodeRuntimeCommandToCodexRequest(
      {
        kind: 'read-thread',
        threadId: 'thread-1',
        includeTurns: true,
      },
      { dynamicTools: [] },
    );
    const turns = encodeRuntimeCommandToCodexRequest(
      {
        kind: 'list-thread-turns',
        threadId: 'thread-1',
        cursor: 'turn-0',
        limit: 10,
        sortDirection: 'asc',
      },
      { dynamicTools: [] },
    );
    const rollback = encodeRuntimeCommandToCodexRequest(
      {
        kind: 'rollback-thread',
        threadId: 'thread-1',
        numTurns: 2,
      },
      { dynamicTools: [] },
    );
    const steer = encodeRuntimeCommandToCodexRequest(
      {
        kind: 'steer-turn',
        threadId: 'thread-1',
        expectedTurnId: 'turn-1',
        message: 'continue',
        content: [],
        responsesapiClientMetadata: {
          client: 'test',
        },
      },
      { dynamicTools: [] },
    );

    assert.deepEqual(fork, {
      method: 'thread/fork',
      params: {
        threadId: 'thread-1',
        path: '/rollout.jsonl',
        cwd: '/workspace',
        ephemeral: true,
        persistExtendedHistory: true,
      },
    });
    assert.deepEqual(read, {
      method: 'thread/read',
      params: {
        threadId: 'thread-1',
        includeTurns: true,
      },
    });
    assert.deepEqual(turns, {
      method: 'thread/turns/list',
      params: {
        threadId: 'thread-1',
        cursor: 'turn-0',
        limit: 10,
        sortDirection: 'asc',
      },
    });
    assert.deepEqual(rollback, {
      method: 'thread/rollback',
      params: {
        threadId: 'thread-1',
        numTurns: 2,
      },
    });
    assert.deepEqual(steer, {
      method: 'turn/steer',
      params: {
        threadId: 'thread-1',
        input: [
          {
            type: 'text',
            text: 'continue',
            text_elements: [],
          },
        ],
        responsesapiClientMetadata: {
          client: 'test',
        },
        expectedTurnId: 'turn-1',
      },
    });
  });

  test('encodes all supported turn content item variants', () => {
    const request = encodeRuntimeCommandToCodexRequest(
      {
        kind: 'start-turn',
        threadId: 'thread-1',
        message: 'fallback',
        content: [
          {
            kind: 'remote-image',
            imageUrl: 'https://example.test/image.png',
          },
          {
            kind: 'skill',
            name: 'reader',
            path: '/skills/reader',
          },
          {
            kind: 'mention',
            name: 'design',
            path: 'app://figma/file',
          },
        ],
        runtimeSettings: null,
      },
      { dynamicTools: [] },
    );

    assert.deepEqual(request.params.input, [
      {
        type: 'image',
        url: 'https://example.test/image.png',
      },
      {
        type: 'skill',
        name: 'reader',
        path: '/skills/reader',
      },
      {
        type: 'mention',
        name: 'design',
        path: 'app://figma/file',
      },
    ]);
  });

  test('allows null permissionProfile values because Codex treats null as absent', () => {
    assert.deepEqual(
      encodeRuntimeCommandToCodexRequest(
        {
          kind: 'start-thread',
          workspace: '/workspace',
          runtimeSettings: fullSettings,
          baseInstructions: null,
          permissionProfile: null,
        },
        { dynamicTools: [] },
      ).params.permissionProfile,
      undefined,
    );
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
      () => encodeRuntimeCommandToCodexRequest(command, { dynamicTools: [] }),
      (error: unknown) =>
        error instanceof CodexProtocolError &&
        error.message === 'Unsupported runtime sandbox mode: networked',
    );
  });

  test('rejects Codex thread permission profile and sandbox conflicts before request dispatch', () => {
    assert.throws(
      () =>
        encodeRuntimeCommandToCodexRequest(
          {
            kind: 'start-thread',
            workspace: '/workspace',
            runtimeSettings: fullSettings,
            baseInstructions: null,
            permissionProfile: {
              network: {
                enabled: true,
              },
            },
          },
          {
            dynamicTools: [],
          },
        ),
      (error: unknown) =>
        error instanceof CodexProtocolError &&
        error.message === 'Codex thread request cannot combine permissionProfile with sandbox',
    );
  });

  test('rejects Codex turn permission profile and sandbox policy conflicts before request dispatch', () => {
    assert.throws(
      () =>
        encodeRuntimeCommandToCodexRequest(
          {
            kind: 'start-turn',
            threadId: 'thread-1',
            message: 'Hello',
            content: [],
            runtimeSettings: null,
            sandboxPolicy: {
              type: 'dangerFullAccess',
            },
            permissionProfile: {
              network: {
                enabled: true,
              },
            },
          },
          {
            dynamicTools: [],
          },
        ),
      (error: unknown) =>
        error instanceof CodexProtocolError &&
        error.message === 'Codex turn request cannot combine permissionProfile with sandboxPolicy',
    );
  });

  test('allows null turn sandboxPolicy values because Codex treats null as absent', () => {
    const request = encodeRuntimeCommandToCodexRequest(
      {
        kind: 'start-turn',
        threadId: 'thread-1',
        message: 'Hello',
        content: [],
        runtimeSettings: null,
        sandboxPolicy: null,
        permissionProfile: {
          network: {
            enabled: true,
          },
        },
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
        permissionProfile: {
          network: {
            enabled: true,
          },
        },
      },
    });
  });
});
