import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { copyCodeBlockText, copyMessageText, type ConversationClipboard } from './conversation-copy.js';

describe('conversation copy behavior', () => {
  test('copies the original message text', async () => {
    const fixture = createClipboardRecorder();
    const originalText = [
      'Hello **Codex**',
      '[site](https://openai.com)',
      '<script>alert(1)</script>',
    ].join('\n');

    await copyMessageText({
      clipboard: fixture.clipboard,
      text: originalText,
    });

    assert.deepEqual(fixture.writes, [
      originalText,
    ]);
  });

  test('copies the original code block text', async () => {
    const fixture = createClipboardRecorder();
    const originalText = [
      'const value = "<script>";',
      '',
      'console.log(value);',
    ].join('\n');

    await copyCodeBlockText({
      clipboard: fixture.clipboard,
      text: originalText,
    });

    assert.deepEqual(fixture.writes, [
      originalText,
    ]);
  });
});

interface ClipboardRecorder {
  readonly clipboard: ConversationClipboard;
  readonly writes: readonly string[];
}

function createClipboardRecorder(): ClipboardRecorder {
  const writes: string[] = [];

  return {
    clipboard: {
      async writeText(text: string): Promise<void> {
        writes.push(text);
      },
    },
    writes,
  };
}
