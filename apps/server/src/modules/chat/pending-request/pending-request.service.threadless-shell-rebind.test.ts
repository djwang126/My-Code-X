import test from 'node:test';
import assert from 'node:assert/strict';

import { createChatService } from '../index.js';

test('threadless requests stay with the same slot when the empty shell is rebound inside that slot', async () => {
  const respondCalls = [];
  const service = createChatService({
    codexGateway: {
      async startThread() {
        throw new Error('startThread should not be called');
      },
      async resumeThread() {
        throw new Error('resumeThread should not be called');
      },
      async respondToRequest({ requestId, response }) {
        respondCalls.push({ requestId, response });
        return { ok: true, requestId };
      },
    },
    now: () => '2026-04-03T10:00:00.000Z',
  });

  await service.hydrateSession({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    threadId: '',
    workspace: 'D:/workspaces/one',
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

  const rebound = await service.hydrateSession({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    threadId: '',
    workspace: 'D:/workspaces/two',
  });

  assert.equal(rebound.workspace, 'D:/workspaces/two');
  assert.deepEqual(rebound.pendingRequests.map(request => request.id), ['req-auth']);

  const response = await service.respondToPendingRequest({
    slotId: 'tab-1',
    threadId: '',
    requestId: 'req-auth',
    response: {
      accessToken: 'token-slot-one',
      chatgptAccountId: 'acct-9',
    },
  });

  assert.deepEqual(response, { ok: true, requestId: 'req-auth' });
  assert.deepEqual(respondCalls, [
    {
      requestId: 'req-auth',
      response: {
        accessToken: 'token-slot-one',
        chatgptAccountId: 'acct-9',
      },
    },
  ]);
});
