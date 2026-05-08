import test from 'node:test';
import assert from 'node:assert/strict';

import { createChatService } from '../index.js';

test('getSessionState requires the matching slot for a thread-scoped lookup', async () => {
  const service = createChatService({
    codexGateway: {
      async startThread() {
        return { threadId: 'thread-1' };
      },
      async resumeThread() {
        throw new Error('resumeThread should not be called');
      },
      async startTurn() {
        return { turnId: 'turn-1' };
      },
    },
    now: () => '2026-04-03T10:00:00.000Z',
  });

  await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    threadId: '',
    text: 'hello codex',
  });

  assert.equal(service.getSessionState({ slotId: 'tab-2', threadId: 'thread-1' }), null);
});
