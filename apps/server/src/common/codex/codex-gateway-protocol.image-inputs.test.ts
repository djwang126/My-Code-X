import test from 'node:test';
import assert from 'node:assert/strict';

import { createStartTurnParams } from './codex-gateway-protocol.js';

test('createStartTurnParams preserves mixed text and localImage input ordering', () => {
  assert.deepEqual(
    createStartTurnParams({
      threadId: 'thread-1',
      cwd: 'D:/workspace/example-app',
      content: [
        { type: 'text', text: 'Inspect this image' },
        { type: 'localImage', path: 'C:/Users/test/.my-code-x/attachments/2026/04/15/att-1.webp' },
      ],
    }),
    {
      threadId: 'thread-1',
      input: [
        { type: 'text', text: 'Inspect this image', text_elements: [] },
        { type: 'localImage', path: 'C:/Users/test/.my-code-x/attachments/2026/04/15/att-1.webp' },
      ],
      cwd: 'D:/workspace/example-app',
    },
  );
});
