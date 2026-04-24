import test from 'node:test';
import assert from 'node:assert/strict';

import { createChatService } from '../index.js';

test('threadless request submit failures recover on the new owner runtime after takeover', async () => {
  let rejectRespond;
  const service = createChatService({
    codexGateway: {
      async startThread() {
        return { threadId: 'thread-1' };
      },
      async resumeThread({ threadId }) {
        return {
          threadId,
          latestTurn: {
        id: 'turn-1',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
          messages: [],
          pendingRequests: [],
        };
      },
      async startTurn() {
        return { turnId: 'turn-1' };
      },
      async respondToRequest() {
        return await new Promise((_, reject) => {
          rejectRespond = reject;
        });
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

  service.applyGatewayEvent({
    type: 'pending_request_updated',
    threadId: '',
    request: {
      id: 'req-auth',
      method: 'account/chatgptAuthTokens/refresh',
      kind: 'auth_refresh',
      threadId: '',
      turnId: null,
      title: 'Refresh ChatGPT authentication',
      prompt: 'Codex needs refreshed ChatGPT credentials.',
      previousAccountId: 'acct-9',
      submitState: 'idle',
      raw: {
        reason: 'unauthorized',
      },
    },
  });

  const responsePromise = service.respondToPendingRequest({
    slotId: 'tab-1',
    threadId: '',
    requestId: 'req-auth',
    response: {
      accessToken: 'token-tab-one',
      chatgptAccountId: 'acct-9',
    },
  });

  assert.equal(
    service.getSessionState({ slotId: 'tab-1', threadId: 'thread-1' })?.pendingRequests[0]?.submitState,
    'submitting',
  );

  await service.hydrateSession({
    viewerId: 'viewer-2',
    slotId: 'tab-2',
    threadId: 'thread-1',
  });

  assert.equal(service.getSessionState({ slotId: 'tab-1', threadId: 'thread-1' }), null);
  assert.equal(
    service.getSessionState({ slotId: 'tab-2', threadId: 'thread-1' })?.pendingRequests[0]?.submitState,
    'submitting',
  );

  rejectRespond(new Error('network failed'));

  await assert.rejects(responsePromise, error => error instanceof Error && error.message === 'network failed');
  assert.equal(
    service.getSessionState({ slotId: 'tab-2', threadId: 'thread-1' })?.pendingRequests[0]?.submitState,
    'idle',
  );
});
