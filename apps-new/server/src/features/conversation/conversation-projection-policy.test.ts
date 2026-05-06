import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { JsonObject, RuntimeThreadItem, RuntimeTurn } from '../../ports/index.js';
import { projectRuntimeDeltaState, projectRuntimeTurnDiff, projectRuntimeTurnPlan } from './conversation-delta-projection.js';
import { createConversationErrorItemId, projectRuntimeError } from './conversation-error-projection.js';
import { projectConversationItemFields } from './conversation-field-projection.js';
import {
  createRuntimeTurnConversationOrder,
  projectRuntimeThreadItem,
  projectRuntimeTimeline,
  projectRuntimeTurns,
} from './conversation-item-projection.js';
import { areSameConversationItems } from './conversation-item-equality.js';
import {
  isRuntimeWorkTraceItemKind,
  mapRuntimeDeltaKindToConversationCodexType,
  readRuntimeMessageRole,
} from './conversation-item-kind-policy.js';

describe('conversation projection policy', () => {
  test('projects raw payload fields in original order without filtering useful debug fields', () => {
    const raw: JsonObject = {
      type: 'plan',
      id: 'plan-1',
      status: 'completed',
      steps: [{ step: 'Read docs', done: true }],
    };

    assert.deepEqual(projectConversationItemFields({ raw }), [
      { name: 'type', value: 'plan' },
      { name: 'id', value: 'plan-1' },
      { name: 'status', value: 'completed' },
      { name: 'steps', value: [{ step: 'Read docs', done: true }] },
    ]);
  });

  test('projects missing raw payload as an empty field list', () => {
    assert.deepEqual(projectConversationItemFields({ raw: undefined }), []);
  });

  test('centralizes runtime item kind policy', () => {
    assert.equal(readRuntimeMessageRole(createUserMessageItem()), 'user');
    assert.equal(readRuntimeMessageRole(createAgentMessageItem()), 'assistant');
    assert.equal(readRuntimeMessageRole(createPlanItem()), null);

    for (const itemKind of [
      'hookPrompt',
      'plan',
      'reasoning',
      'commandExecution',
      'fileChange',
      'mcpToolCall',
      'dynamicToolCall',
      'collabAgentToolCall',
      'webSearch',
      'imageView',
      'imageGeneration',
      'enteredReviewMode',
      'exitedReviewMode',
      'contextCompaction',
    ]) {
      assert.equal(isRuntimeWorkTraceItemKind(itemKind), true);
    }

    assert.equal(isRuntimeWorkTraceItemKind('unknown'), false);
  });

  test('centralizes runtime delta kind mapping', () => {
    assert.equal(mapRuntimeDeltaKindToConversationCodexType('agent-message'), 'agentMessage');
    assert.equal(mapRuntimeDeltaKindToConversationCodexType('plan'), 'plan');
    assert.equal(mapRuntimeDeltaKindToConversationCodexType('reasoning-summary-text'), 'reasoning');
    assert.equal(mapRuntimeDeltaKindToConversationCodexType('reasoning-summary-part'), 'reasoning');
    assert.equal(mapRuntimeDeltaKindToConversationCodexType('reasoning-text'), 'reasoning');
    assert.equal(mapRuntimeDeltaKindToConversationCodexType('command-output'), 'commandExecution');
    assert.equal(mapRuntimeDeltaKindToConversationCodexType('terminal-interaction'), 'commandExecution');
    assert.equal(mapRuntimeDeltaKindToConversationCodexType('file-change-output'), 'fileChange');
    assert.equal(mapRuntimeDeltaKindToConversationCodexType('file-change-patch'), 'fileChange');
    assert.equal(mapRuntimeDeltaKindToConversationCodexType('mcp-tool-progress'), 'mcpToolCall');
  });

  test('projects runtime error with turn-scoped stable item id and original message only', () => {
    assert.equal(createConversationErrorItemId({ turnId: 'turn-1' }), 'error:turn-1');
    assert.deepEqual(projectRuntimeError({
      turnId: 'turn-1',
      error: {
        message: 'runtime failed',
        code: 'RUNTIME_FAILED',
        details: 'upstream details',
      },
    }), {
      id: 'error:turn-1',
      kind: 'error',
      message: 'runtime failed',
    });
  });

  test('projects accumulated delta states as conversation items', () => {
    assert.deepEqual(projectRuntimeDeltaState({
      state: {
        itemId: 'agent-1',
        kind: 'agentMessage',
        text: 'hello',
      },
    }), {
      id: 'agent-1',
      kind: 'message',
      role: 'assistant',
      text: 'hello',
    });

    assert.deepEqual(projectRuntimeDeltaState({
      state: {
        itemId: 'cmd-1',
        kind: 'commandExecution',
        aggregatedOutput: 'output',
        terminalInput: 'input',
      },
    }), {
      id: 'cmd-1',
      kind: 'work-trace',
      codexType: 'commandExecution',
      fields: [
        { name: 'id', value: 'cmd-1' },
        { name: 'type', value: 'commandExecution' },
        { name: 'aggregatedOutput', value: 'output' },
        { name: 'terminalInput', value: 'input' },
      ],
    });

    assert.deepEqual(projectRuntimeDeltaState({
      state: {
        itemId: 'plan-delta-1',
        kind: 'plan',
        text: 'Read docs\nImplement change',
      },
    }), {
      id: 'plan-delta-1',
      kind: 'work-trace',
      codexType: 'plan',
      fields: [
        { name: 'id', value: 'plan-delta-1' },
        { name: 'type', value: 'plan' },
        { name: 'text', value: 'Read docs\nImplement change' },
      ],
    });

    assert.deepEqual(projectRuntimeDeltaState({
      state: {
        itemId: 'reasoning-1',
        kind: 'reasoning',
        summary: ['summary'],
        content: ['content'],
      },
    }), {
      id: 'reasoning-1',
      kind: 'work-trace',
      codexType: 'reasoning',
      fields: [
        { name: 'id', value: 'reasoning-1' },
        { name: 'type', value: 'reasoning' },
        { name: 'summary', value: ['summary'] },
        { name: 'content', value: ['content'] },
      ],
    });

    assert.deepEqual(projectRuntimeDeltaState({
      state: {
        itemId: 'file-change-1',
        kind: 'fileChange',
        output: 'patched file\n',
        changes: [{ path: 'src/app.ts', status: 'modified' }],
      },
    }), {
      id: 'file-change-1',
      kind: 'work-trace',
      codexType: 'fileChange',
      fields: [
        { name: 'id', value: 'file-change-1' },
        { name: 'type', value: 'fileChange' },
        { name: 'output', value: 'patched file\n' },
        { name: 'changes', value: [{ path: 'src/app.ts', status: 'modified' }] },
      ],
    });

    assert.deepEqual(projectRuntimeDeltaState({
      state: {
        itemId: 'mcp-1',
        kind: 'mcpToolCall',
        progressMessages: ['first', 'second'],
      },
    }), {
      id: 'mcp-1',
      kind: 'work-trace',
      codexType: 'mcpToolCall',
      fields: [
        { name: 'id', value: 'mcp-1' },
        { name: 'type', value: 'mcpToolCall' },
        { name: 'progressMessages', value: ['first', 'second'] },
      ],
    });
  });

  test('projects synthetic turn plan and diff items with stable ids', () => {
    assert.deepEqual(projectRuntimeTurnPlan({
      turnId: 'turn-1',
      explanation: 'Plan',
      plan: [{ step: 'Read docs', done: false }],
    }), {
      id: 'plan:turn-1',
      kind: 'work-trace',
      codexType: 'plan',
      fields: [
        { name: 'turnId', value: 'turn-1' },
        { name: 'explanation', value: 'Plan' },
        { name: 'plan', value: [{ step: 'Read docs', done: false }] },
      ],
    });

    assert.deepEqual(projectRuntimeTurnDiff({
      turnId: 'turn-1',
      diff: 'diff --git a/file b/file',
    }), {
      id: 'diff:turn-1',
      kind: 'work-trace',
      codexType: 'fileChange',
      fields: [
        { name: 'turnId', value: 'turn-1' },
        { name: 'diff', value: 'diff --git a/file b/file' },
      ],
    });
  });

  test('projects runtime thread items without reinterpreting upstream semantics', () => {
    assert.deepEqual(projectRuntimeThreadItem({ item: createUserMessageItem() }), {
      id: 'user-1',
      kind: 'message',
      role: 'user',
      text: 'hello',
    });
    assert.deepEqual(projectRuntimeThreadItem({ item: createAgentMessageItem() }), {
      id: 'agent-1',
      kind: 'message',
      role: 'assistant',
      text: 'world',
    });
    assert.deepEqual(projectRuntimeThreadItem({ item: createPlanItem() }), {
      id: 'plan-1',
      kind: 'work-trace',
      codexType: 'plan',
      fields: [
        { name: 'id', value: 'plan-1' },
        { name: 'type', value: 'plan' },
        { name: 'status', value: 'completed' },
      ],
    });
    assert.deepEqual(projectRuntimeThreadItem({ item: createUnknownItem() }), {
      id: 'future-1',
      kind: 'unknown',
      codexType: 'futureItem',
      fields: [
        { name: 'id', value: 'future-1' },
        { name: 'type', value: 'futureItem' },
      ],
    });
    assert.equal(projectRuntimeThreadItem({ item: createUnsupportedItem() }), null);
  });

  test('projects timeline and turns in source order including failed turn error items', () => {
    assert.deepEqual(projectRuntimeTimeline({
      items: [
        createUserMessageItem(),
        createPlanItem(),
        createAgentMessageItem(),
      ],
    }).map(item => item.id), ['user-1', 'plan-1', 'agent-1']);

    const turns: readonly RuntimeTurn[] = [
      createTurn({
        id: 'turn-1',
        items: [createUserMessageItem(), createPlanItem()],
        status: 'completed',
        error: null,
      }),
      createTurn({
        id: 'turn-2',
        items: [createAgentMessageItem()],
        status: 'failed',
        error: {
          message: 'failed turn',
          code: null,
        },
      }),
    ];

    assert.deepEqual(projectRuntimeTurns({ turns }).map(item => item.id), [
      'user-1',
      'plan-1',
      'agent-1',
      'error:turn-2',
    ]);
    assert.deepEqual(createRuntimeTurnConversationOrder({ turns }), [
      'user-1',
      'plan-1',
      'agent-1',
      'error:turn-2',
    ]);
  });

  test('compares conversation items by product kind and fields without changing existing semantics', () => {
    assert.equal(areSameConversationItems({
      id: 'message-1',
      kind: 'message',
      role: 'assistant',
      text: 'hello',
    }, {
      id: 'message-1',
      kind: 'message',
      role: 'assistant',
      text: 'hello',
    }), true);
    assert.equal(areSameConversationItems({
      id: 'message-1',
      kind: 'message',
      role: 'assistant',
      text: 'hello',
    }, {
      id: 'message-1',
      kind: 'message',
      role: 'assistant',
      text: 'changed',
    }), false);
    assert.equal(areSameConversationItems({
      id: 'trace-1',
      kind: 'work-trace',
      codexType: 'plan',
      fields: [
        { name: 'type', value: 'plan' },
        { name: 'id', value: 'trace-1' },
      ],
    }, {
      id: 'trace-1',
      kind: 'work-trace',
      codexType: 'plan',
      fields: [
        { name: 'id', value: 'trace-1' },
        { name: 'type', value: 'plan' },
      ],
    }), false);
    assert.equal(areSameConversationItems({
      id: 'trace-1',
      kind: 'work-trace',
      codexType: 'plan',
      fields: [],
    }, {
      id: 'trace-1',
      kind: 'unknown',
      codexType: 'plan',
      fields: [],
    }), false);
    assert.equal(areSameConversationItems({
      id: 'error:turn-1',
      kind: 'error',
      message: 'old',
    }, {
      id: 'error:turn-1',
      kind: 'error',
      message: 'new',
    }), false);
  });
});

function createUserMessageItem(): RuntimeThreadItem {
  return {
    itemId: 'user-1',
    itemKind: 'userMessage',
    status: null,
    text: 'hello',
    content: ['hello'],
    raw: {
      id: 'user-1',
      type: 'userMessage',
      content: ['hello'],
    },
  };
}

function createAgentMessageItem(): RuntimeThreadItem {
  return {
    itemId: 'agent-1',
    itemKind: 'agentMessage',
    status: null,
    text: 'world',
    phase: null,
    memoryCitation: null,
    raw: {
      id: 'agent-1',
      type: 'agentMessage',
      text: 'world',
    },
  };
}

function createPlanItem(): RuntimeThreadItem {
  return {
    itemId: 'plan-1',
    itemKind: 'plan',
    status: 'completed',
    text: null,
    raw: {
      id: 'plan-1',
      type: 'plan',
      status: 'completed',
    },
  };
}

function createUnknownItem(): RuntimeThreadItem {
  return {
    itemId: 'future-1',
    itemKind: 'unknown',
    unknownItemKind: 'futureItem',
    status: null,
    text: null,
    raw: {
      id: 'future-1',
      type: 'futureItem',
    },
  };
}

function createUnsupportedItem(): RuntimeThreadItem {
  return {
    itemId: 'unsupported-1',
    itemKind: 'unsupported',
    status: null,
    text: null,
  } as unknown as RuntimeThreadItem;
}

interface CreateTurnInput {
  readonly id: string;
  readonly items: readonly RuntimeThreadItem[];
  readonly status: RuntimeTurn['status'];
  readonly error: RuntimeTurn['error'];
}

function createTurn(input: CreateTurnInput): RuntimeTurn {
  return {
    id: input.id,
    items: input.items,
    status: input.status,
    error: input.error,
    startedAt: null,
    completedAt: null,
    durationMs: null,
  };
}
