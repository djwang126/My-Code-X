import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { copyCodeBlockText, copyMessageText } from './conversation-copy.js';

interface ConversationClipboard {
  writeText(text: string): Promise<void>;
}

describe('conversation copy actions', () => {
  test('copies the raw markdown message text instead of rendered content', async () => {
    const clipboard = createMemoryClipboard();

    await copyMessageText({
      clipboard,
      text: 'Hello **Codex**\n\n```ts\nconst value = 1;\n```',
    });

    assert.deepEqual(clipboard.writes, [
      'Hello **Codex**\n\n```ts\nconst value = 1;\n```',
    ]);
  });

  test('copies the raw fenced code text for a code block', async () => {
    const clipboard = createMemoryClipboard();

    await copyCodeBlockText({
      clipboard,
      text: 'const value = 1;',
    });

    assert.deepEqual(clipboard.writes, [
      'const value = 1;',
    ]);
  });
});

interface MemoryClipboard extends ConversationClipboard {
  readonly writes: readonly string[];
}

function createMemoryClipboard(): MemoryClipboard {
  const writes: string[] = [];

  return {
    writes,
    async writeText(text: string): Promise<void> {
      writes.push(text);
    },
  };
}
