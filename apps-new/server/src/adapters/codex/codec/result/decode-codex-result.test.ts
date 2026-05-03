import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { CodexProtocolError } from '../../errors/codex-runtime-error.js';
import { decodeCodexResultToRuntimeResult } from './decode-codex-result.js';
import type { JsonObject } from '@my-code-x/contracts-new/json';

function createCodexThread(overrides: JsonObject = {}): JsonObject {
  return {
    id: 'thread-1',
    forkedFromId: null,
    preview: 'Hello',
    ephemeral: false,
    modelProvider: 'openai',
    createdAt: 1770000000,
    updatedAt: 1770000300,
    status: { type: 'idle' },
    path: 'C:/Users/David/.codex/sessions/2026/04/29/rollout.jsonl',
    cwd: '/workspace',
    cliVersion: '0.0.0',
    source: { type: 'appServer' },
    agentNickname: null,
    agentRole: null,
    gitInfo: null,
    name: 'Thread title',
    turns: [],
    ...overrides,
  };
}

function createCodexTurn(overrides: JsonObject = {}): JsonObject {
  return {
    id: 'turn-1',
    items: [],
    status: 'completed',
    error: null,
    startedAt: 1770000001,
    completedAt: 1770000003,
    durationMs: 2000,
    ...overrides,
  };
}

describe('decodeCodexResultToRuntimeResult', () => {
  test('decodes a Codex v2 thread/start result into a rich internal thread-started result', () => {
    const result = decodeCodexResultToRuntimeResult({
      command: {
        kind: 'start-thread',
        workspace: '/workspace',
        runtimeSettings: null,
        baseInstructions: null,
      },
      result: {
        thread: createCodexThread(),
        model: 'gpt-5.4',
        modelProvider: 'openai',
        serviceTier: null,
        cwd: '/workspace',
        instructionSources: ['/workspace/AGENTS.md'],
        approvalPolicy: 'never',
        approvalsReviewer: 'user',
        sandbox: { type: 'workspaceWrite' },
        permissionProfile: null,
        reasoningEffort: 'high',
      },
    });

    assert.equal(result.kind, 'thread-started');
    assert.equal(result.threadId, 'thread-1');
    assert.equal(result.thread?.preview, 'Hello');
    assert.deepEqual(result.effectiveConfig?.instructionSources, ['/workspace/AGENTS.md']);
  });

  test('decodes a Codex v2 thread/resume result from thread.turns items', () => {
    const result = decodeCodexResultToRuntimeResult({
      command: {
        kind: 'resume-thread',
        threadId: 'thread-1',
        workspace: '/workspace',
        runtimeSettings: null,
        baseInstructions: null,
      },
      result: {
        thread: createCodexThread({
          turns: [
            createCodexTurn({
              items: [
                {
                  type: 'userMessage',
                  id: 'user-item-1',
                  content: [{ type: 'text', text: 'Hello', text_elements: [] }],
                },
                {
                  type: 'agentMessage',
                  id: 'agent-item-1',
                  text: 'Hi',
                  phase: null,
                  memoryCitation: null,
                },
              ],
            }),
          ],
        }),
        model: 'gpt-5.4',
        modelProvider: 'openai',
        serviceTier: null,
        cwd: '/workspace',
        instructionSources: [],
        approvalPolicy: 'never',
        approvalsReviewer: 'user',
        sandbox: { type: 'dangerFullAccess' },
        permissionProfile: null,
        reasoningEffort: null,
      },
    });

    assert.equal(result.kind, 'thread-resumed');
    assert.equal(result.threadId, 'thread-1');
    assert.equal(result.snapshot.threadId, 'thread-1');
    assert.equal(result.snapshot.title, 'Thread title');
    assert.equal(result.snapshot.turns?.[0]?.id, 'turn-1');
    assert.deepEqual(
      result.snapshot.items.map(item => [item.itemKind, item.text]),
      [
        ['userMessage', 'Hello'],
        ['agentMessage', 'Hi'],
      ],
    );
    assert.deepEqual(result.snapshot.pendingInputs, []);
  });

  test('decodes a Codex v2 thread/list result from data and cursors', () => {
    const result = decodeCodexResultToRuntimeResult({
      command: {
        kind: 'list-threads',
        workspace: '/workspace',
        limit: 10,
        archived: false,
      },
      result: {
        data: [createCodexThread({ id: 'thread-1', name: 'First', turns: [] })],
        nextCursor: 'next-1',
        backwardsCursor: 'back-1',
      },
    });

    assert.equal(result.kind, 'threads-listed');
    assert.equal(result.threads[0]?.threadId, 'thread-1');
    assert.equal(result.threads[0]?.title, 'First');
    assert.equal(result.nextCursor, 'next-1');
    assert.equal(result.backwardsCursor, 'back-1');
  });

  test('preserves structured Codex thread item semantics instead of only raw text', () => {
    const result = decodeCodexResultToRuntimeResult({
      command: {
        kind: 'resume-thread',
        threadId: 'thread-1',
        workspace: '/workspace',
        runtimeSettings: null,
        baseInstructions: null,
      },
      result: {
        thread: createCodexThread({
          turns: [
            createCodexTurn({
              items: [
                {
                  type: 'commandExecution',
                  id: 'cmd-1',
                  command: 'npm test',
                  cwd: '/workspace',
                  processId: 'proc-1',
                  source: 'agent',
                  status: 'completed',
                  commandActions: [{ type: 'test' }],
                  aggregatedOutput: 'ok',
                  exitCode: 0,
                  durationMs: 123,
                },
              ],
            }),
          ],
        }),
        model: 'gpt-5.4',
        modelProvider: 'openai',
        serviceTier: null,
        cwd: '/workspace',
        instructionSources: [],
        approvalPolicy: 'never',
        approvalsReviewer: 'user',
        sandbox: { type: 'dangerFullAccess' },
        permissionProfile: null,
        reasoningEffort: null,
      },
    });

    assert.equal(result.kind, 'thread-resumed');
    const item = result.snapshot.items[0];
    assert.equal(item?.itemKind, 'commandExecution');
    assert.equal(item?.text, 'npm test');
    if (item?.itemKind !== 'commandExecution') {
      assert.fail('expected a structured commandExecution item');
    }
    assert.equal(item.command, 'npm test');
    assert.equal(item.cwd, '/workspace');
    assert.equal(item.exitCode, 0);
    assert.equal(item.durationMs, 123);
  });

  test('decodes Codex v2 thread/fork, thread/read, and thread/turns/list results', () => {
    const forkResult = decodeCodexResultToRuntimeResult({
      command: {
        kind: 'fork-thread',
        threadId: 'thread-1',
        workspace: '/workspace',
        runtimeSettings: null,
        baseInstructions: null,
      },
      result: {
        thread: createCodexThread({ id: 'thread-2', forkedFromId: 'thread-1' }),
        model: 'gpt-5.4',
        modelProvider: 'openai',
        serviceTier: null,
        cwd: '/workspace',
        instructionSources: [],
        approvalPolicy: 'never',
        approvalsReviewer: 'user',
        sandbox: { type: 'dangerFullAccess' },
        permissionProfile: null,
        reasoningEffort: null,
      },
    });
    assert.equal(forkResult.kind, 'thread-forked');
    assert.equal(forkResult.threadId, 'thread-2');

    const readResult = decodeCodexResultToRuntimeResult({
      command: { kind: 'read-thread', threadId: 'thread-1', includeTurns: true },
      result: { thread: createCodexThread() },
    });
    assert.equal(readResult.kind, 'thread-read');
    assert.equal(readResult.threadId, 'thread-1');

    const turnsResult = decodeCodexResultToRuntimeResult({
      command: { kind: 'list-thread-turns', threadId: 'thread-1', limit: 1 },
      result: { data: [createCodexTurn()], nextCursor: null, backwardsCursor: 'turn-1' },
    });
    assert.equal(turnsResult.kind, 'thread-turns-listed');
    assert.equal(turnsResult.turns?.[0]?.id, 'turn-1');
    assert.equal(turnsResult.backwardsCursor, 'turn-1');
  });

  test('decodes Codex v2 turn/start, turn/steer, and turn/interrupt results', () => {
    const startResult = decodeCodexResultToRuntimeResult({
      command: {
        kind: 'start-turn',
        threadId: 'thread-1',
        message: 'Hello',
        content: [],
        runtimeSettings: null,
      },
      result: {
        turn: createCodexTurn({ status: 'inProgress', completedAt: null, durationMs: null }),
      },
    });
    assert.equal(startResult.kind, 'turn-started');
    assert.equal(startResult.turnId, 'turn-1');
    assert.equal(startResult.turn?.status, 'inProgress');

    const steerResult = decodeCodexResultToRuntimeResult({
      command: {
        kind: 'steer-turn',
        threadId: 'thread-1',
        expectedTurnId: 'turn-1',
        message: 'More',
        content: [],
      },
      result: { turnId: 'turn-1' },
    });
    assert.deepEqual(steerResult, { kind: 'turn-steered', turnId: 'turn-1' });

    const interruptResult = decodeCodexResultToRuntimeResult({
      command: { kind: 'interrupt-turn', threadId: 'thread-1', turnId: 'turn-1' },
      result: {},
    });
    assert.deepEqual(interruptResult, { kind: 'ok' });
  });

  test('rejects a Codex v2 thread/list result without data', () => {
    assert.throws(
      () =>
        decodeCodexResultToRuntimeResult({
          command: {
            kind: 'list-threads',
            workspace: '/workspace',
            limit: 10,
            archived: false,
          },
          result: { threads: [createCodexThread()] },
        }),
      (error: unknown) =>
        error instanceof CodexProtocolError &&
        error.message === 'Codex thread/list result.data must be an array',
    );
  });

  test('rejects malformed v2 payloads at the adapter boundary', () => {
    assert.throws(
      () =>
        decodeCodexResultToRuntimeResult({
          command: {
            kind: 'resume-thread',
            threadId: 'thread-1',
            workspace: '/workspace',
            runtimeSettings: null,
            baseInstructions: null,
          },
          result: { threadId: 'thread-1' },
        }),
      (error: unknown) =>
        error instanceof CodexProtocolError &&
        error.message === 'Codex thread/resume result.thread must be an object',
    );

    assert.throws(
      () =>
        decodeCodexResultToRuntimeResult({
          command: {
            kind: 'start-turn',
            threadId: 'thread-1',
            message: 'Hello',
            content: [],
            runtimeSettings: null,
          },
          result: { turn: {} },
        }),
      (error: unknown) =>
        error instanceof CodexProtocolError &&
        error.message === 'Codex turn/start result.turn.id must be a string',
    );
  });
});
