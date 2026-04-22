import test from 'node:test';
import assert from 'node:assert/strict';

import { createChatService } from './chat.service.js';

function waitForMaintenance() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

test('chat service schedules attachment maintenance on startup and after uploads', async () => {
  const pruneCalls = [];
  const chatService = createChatService({
    codexGateway: {},
    attachmentService: {
      metadataStore: {},
      async uploadAttachment() {
        return {
          attachmentId: 'att-1',
          contentType: 'image/webp',
          width: 1200,
          height: 900,
          byteLength: 123_456,
        };
      },
    },
    attachmentRetentionService: {
      async pruneExpiredAttachments() {
        pruneCalls.push('pruned');
        return {
          keptAttachmentIds: [],
          prunedAttachmentIds: [],
          missingAttachmentIds: [],
        };
      },
    },
  });

  await waitForMaintenance();
  await chatService.uploadAttachment({
    buffer: Buffer.from('image'),
    contentType: 'image/png',
    filename: 'screen.png',
  });
  await waitForMaintenance();

  assert.equal(pruneCalls.length, 2);
});
