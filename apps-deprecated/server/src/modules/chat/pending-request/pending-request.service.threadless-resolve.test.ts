import test from 'node:test';
import assert from 'node:assert/strict';

import { createChatService } from '../index.js';

test('threadless auth refresh requests are attached to the active slot session and clear on resolve', async () => {
  const events = [];
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
      async respondToRequest() {
        return { ok: true };
      },
    },
    now: () => '2026-04-03T10:00:00.000Z',
  });

  service.subscribe({ slotId: 'tab-1', threadId: 'thread-1' }, event => {
    events.push(event);
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

  assert.deepEqual(service.getSessionState({ slotId: 'tab-1', threadId: 'thread-1' })?.pendingRequests, [
    {
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
  ]);

  service.applyGatewayEvent({
    type: 'pending_request_resolved',
    threadId: '',
    requestId: 'req-auth',
    notice: {
      id: 'serverRequest/resolved:req-auth',
      level: 'info',
      title: 'Request resolved',
      text: 'Resolved request req-auth',
      raw: {
        requestId: 'req-auth',
      },
    },
  });

  assert.deepEqual(service.getSessionState({ slotId: 'tab-1', threadId: 'thread-1' })?.pendingRequests, []);
  assert.deepEqual(events, [
    {
      type: 'turn_started',
      threadId: 'thread-1',
      turnExecution: {
        activeTurnId: 'turn-1',
        turnLifecycle: 'running',
      },
    },
    {
      type: 'pending_request_updated',
      threadId: 'thread-1',
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
    },
    {
      type: 'pending_request_resolved',
      threadId: 'thread-1',
      requestId: 'req-auth',
      notice: {
        id: 'serverRequest/resolved:req-auth',
        level: 'info',
        title: 'Request resolved',
        text: 'Resolved request req-auth',
        raw: {
          requestId: 'req-auth',
        },
      },
    },
  ]);
});
test('threadless requests move to the new slot session when another slot takes over the thread', async () => {
  const respondCalls = [];
  const service = createChatService({
    codexGateway: {
      async startThread() {
        return { threadId: 'thread-1' };
      },
      async resumeThread({ threadId }) {
        return {
          threadId,
          turnExecution: {
            activeTurnId: 'turn-1',
            turnLifecycle: 'running',
          },
          messages: [],
          pendingRequests: [],
        };
      },
      async startTurn() {
        return { turnId: 'turn-1' };
      },
      async respondToRequest({ requestId, response }) {
        respondCalls.push({ requestId, response });
        return { ok: true, requestId };
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

  const restored = await service.hydrateSession({
    viewerId: 'viewer-2',
    slotId: 'tab-2',
    threadId: 'thread-1',
  });

  assert.deepEqual(restored.pendingRequests, [
    {
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
  ]);
  assert.equal(service.getSessionState({ slotId: 'tab-1', threadId: 'thread-1' }), null);
  assert.deepEqual(service.getSessionState({ slotId: 'tab-2', threadId: 'thread-1' })?.pendingRequests, [
    {
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
  ]);

  const response = await service.respondToPendingRequest({
    slotId: 'tab-2',
    threadId: '',
    requestId: 'req-auth',
    response: {
      accessToken: 'token-tab-two',
      chatgptAccountId: 'acct-9',
    },
  });

  assert.deepEqual(response, { ok: true, requestId: 'req-auth' });
  assert.deepEqual(respondCalls, [
    {
      requestId: 'req-auth',
      response: {
        accessToken: 'token-tab-two',
        chatgptAccountId: 'acct-9',
      },
    },
  ]);

  service.applyGatewayEvent({
    type: 'pending_request_resolved',
    threadId: '',
    requestId: 'req-auth',
    notice: {
      id: 'serverRequest/resolved:req-auth',
      level: 'info',
      title: 'Request resolved',
      text: 'Resolved request req-auth',
      raw: {
        requestId: 'req-auth',
      },
    },
  });

  assert.deepEqual(service.getSessionState({ slotId: 'tab-2', threadId: 'thread-1' })?.pendingRequests, []);
  assert.deepEqual(service.getSessionState({ slotId: 'tab-2', threadId: 'thread-1' })?.notices, [
    {
      id: 'serverRequest/resolved:req-auth',
      level: 'info',
      title: 'Request resolved',
      text: 'Resolved request req-auth',
      raw: {
        requestId: 'req-auth',
      },
    },
  ]);
});

