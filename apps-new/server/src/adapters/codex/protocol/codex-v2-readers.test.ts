import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { readCodexThread, readCodexThreadItem } from './codex-v2-readers.js';
import type { JsonObject } from '../../../shared/index.js';

function readItem(item: JsonObject) {
  return readCodexThreadItem(item, 'test item');
}

interface ThreadItemReaderCase {
  readonly item: JsonObject;
  readonly itemKind: string;
  readonly text: string;
}

describe('codex-v2-readers', () => {
  test('reads Codex thread turns with canonical item parsing', () => {
    const thread = readCodexThread(
      {
        id: 'thread-1',
        name: 'Thread title',
        cwd: '/workspace',
        updatedAt: 1770000000,
        turns: [
          {
            id: 'turn-1',
            status: 'completed',
            items: [
              {
                type: 'userMessage',
                id: 'user-1',
                content: [{ type: 'text', text: 'Hello', text_elements: [] }],
              },
              {
                type: 'agentMessage',
                id: 'agent-1',
                text: 'Hi',
              },
            ],
          },
        ],
      },
      'test thread',
    );

    assert.equal(thread.threadId, 'thread-1');
    assert.equal(thread.title, 'Thread title');
    assert.equal(thread.turns?.[0]?.items[0]?.text, 'Hello');
    assert.equal(thread.turns?.[0]?.items[1]?.text, 'Hi');
  });

  test('preserves every core Codex ThreadItem variant in one parser', () => {
    const cases: readonly ThreadItemReaderCase[] = [
      {
        item: {
          type: 'userMessage',
          id: 'user-1',
          content: [{ type: 'mention', name: 'design', path: 'app://figma/file' }],
        },
        itemKind: 'userMessage',
        text: '[mention: design]',
      },
      {
        item: {
          type: 'hookPrompt',
          id: 'hook-1',
          fragments: [{ text: 'Hook text', hookRunId: 'hook-run-1' }],
        },
        itemKind: 'hookPrompt',
        text: 'Hook text',
      },
      {
        item: {
          type: 'agentMessage',
          id: 'agent-1',
          text: 'Agent text',
          phase: 'final',
          memoryCitation: null,
        },
        itemKind: 'agentMessage',
        text: 'Agent text',
      },
      {
        item: {
          type: 'plan',
          id: 'plan-1',
          text: 'Plan text',
        },
        itemKind: 'plan',
        text: 'Plan text',
      },
      {
        item: {
          type: 'reasoning',
          id: 'reasoning-1',
          summary: ['Reasoning summary'],
          content: ['Hidden reasoning'],
        },
        itemKind: 'reasoning',
        text: 'Reasoning summary',
      },
      {
        item: {
          type: 'commandExecution',
          id: 'cmd-1',
          command: 'npm test',
          cwd: '/workspace',
          commandActions: [],
          exitCode: 0,
        },
        itemKind: 'commandExecution',
        text: 'npm test',
      },
      {
        item: {
          type: 'fileChange',
          id: 'file-1',
          changes: [{ path: 'src/app.ts' }],
        },
        itemKind: 'fileChange',
        text: 'src/app.ts',
      },
      {
        item: {
          type: 'mcpToolCall',
          id: 'mcp-1',
          server: 'github',
          tool: 'search',
        },
        itemKind: 'mcpToolCall',
        text: 'github.search',
      },
      {
        item: {
          type: 'dynamicToolCall',
          id: 'dynamic-1',
          tool: 'browser',
          arguments: {},
        },
        itemKind: 'dynamicToolCall',
        text: 'browser',
      },
      {
        item: {
          type: 'collabAgentToolCall',
          id: 'collab-1',
          tool: 'spawn',
          prompt: 'Review this',
          receiverThreadIds: ['thread-2'],
        },
        itemKind: 'collabAgentToolCall',
        text: 'spawn',
      },
      {
        item: {
          type: 'webSearch',
          id: 'web-1',
          query: 'codex v2',
        },
        itemKind: 'webSearch',
        text: 'codex v2',
      },
      {
        item: {
          type: 'imageView',
          id: 'image-view-1',
          path: '/tmp/image.png',
        },
        itemKind: 'imageView',
        text: '/tmp/image.png',
      },
      {
        item: {
          type: 'imageGeneration',
          id: 'image-gen-1',
          revisedPrompt: 'A cat',
          result: 'ok',
        },
        itemKind: 'imageGeneration',
        text: 'A cat',
      },
      {
        item: {
          type: 'enteredReviewMode',
          id: 'review-in-1',
          review: 'Review started',
        },
        itemKind: 'enteredReviewMode',
        text: 'Review started',
      },
      {
        item: {
          type: 'exitedReviewMode',
          id: 'review-out-1',
          review: 'Review done',
        },
        itemKind: 'exitedReviewMode',
        text: 'Review done',
      },
      {
        item: {
          type: 'contextCompaction',
          id: 'compact-1',
        },
        itemKind: 'contextCompaction',
        text: 'Context compacted',
      },
    ];

    for (const testCase of cases) {
      const item = readItem(testCase.item);
      assert.equal(item.itemKind, testCase.itemKind);
      assert.equal(item.text, testCase.text);
      assert.deepEqual(item.raw, testCase.item);
    }
  });

  test('preserves unknown ThreadItem variants as fallback raw items', () => {
    const item = readItem({
      type: 'futureItem',
      id: 'future-1',
      value: 1,
    });

    assert.equal(item.itemKind, 'unknown');
    assert.equal(item.unknownItemKind, 'futureItem');
    assert.deepEqual(item.raw, {
      type: 'futureItem',
      id: 'future-1',
      value: 1,
    });
  });
});
