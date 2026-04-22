import test from 'node:test';
import assert from 'node:assert/strict';

import { createChatService } from '../index.js';

test('threadless requests stay scoped to the active slot session instead of mirroring into every slot session', async () => {
  let nextThreadId = 1;
  const slotOneEvents = [];
  const slotTwoEvents = [];
  const service = createChatService({
    codexGateway: {
      async startThread() {
        const threadId = `thread-${nextThreadId}`;
        nextThreadId += 1;
        return { threadId };
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

  await service.sendMessage({
    viewerId: 'viewer-1',
    slotId: 'tab-1',
    threadId: '',
    text: 'hello from slot one',
  });

  await service.hydrateSession({
    viewerId: 'viewer-2',
    slotId: 'tab-2',
    threadId: '',
  });

  service.subscribe({ slotId: 'tab-1', threadId: 'thread-1' }, event => {
    slotOneEvents.push(event);
  });

  service.subscribe({ slotId: 'tab-2', threadId: '' }, event => {
    slotTwoEvents.push(event);
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

  assert.deepEqual(service.getSessionState({ slotId: 'tab-1', threadId: 'thread-1' })?.pendingRequests.map(request => request.id), [
    'req-auth',
  ]);
  assert.deepEqual(service.getSessionState({ slotId: 'tab-2', threadId: '' })?.pendingRequests, []);
  assert.deepEqual(slotOneEvents.map(event => event.type), ['pending_request_updated']);
  assert.deepEqual(slotTwoEvents, []);
});

test('threadless request responses are rejected from non-owner slots after the request is scoped', async () => {
  let nextThreadId = 1;
  const respondCalls = [];
  const service = createChatService({
    codexGateway: {
      async startThread() {
        const threadId = `thread-${nextThreadId}`;
        nextThreadId += 1;
        return { threadId };
      },
      async resumeThread() {
        throw new Error('resumeThread should not be called');
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
    text: 'hello from slot one',
  });

  await service.hydrateSession({
    viewerId: 'viewer-2',
    slotId: 'tab-2',
    threadId: '',
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

  await assert.rejects(
    service.respondToPendingRequest({
      slotId: 'tab-2',
      threadId: '',
      requestId: 'req-auth',
      response: {
        accessToken: 'token-slot-two',
        chatgptAccountId: 'acct-9',
      },
    }),
    error => error instanceof Error && error.message === 'request not found',
  );

  const result = await service.respondToPendingRequest({
    slotId: 'tab-1',
    threadId: '',
    requestId: 'req-auth',
    response: {
      accessToken: 'token-slot-one',
      chatgptAccountId: 'acct-9',
    },
  });

  assert.deepEqual(result, { ok: true, requestId: 'req-auth' });
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

test('threadless requests do not move to a different slot when a fresh slot bootstraps without a thread', async () => {
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
    workspace: 'D:/workspaces/My-Code-X',
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
    viewerId: 'viewer-1',
    slotId: 'tab-2',
    threadId: '',
    workspace: 'D:/workspaces/My-Code-X',
  });

  assert.deepEqual(restored.pendingRequests, []);
  assert.deepEqual(service.getSessionState({ slotId: 'tab-1', threadId: '' })?.pendingRequests, [
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

  await assert.rejects(
    service.respondToPendingRequest({
      slotId: 'tab-2',
      threadId: '',
      requestId: 'req-auth',
      response: {
        accessToken: 'token-slot-two',
        chatgptAccountId: 'acct-9',
      },
    }),
    error => error instanceof Error && error.message === 'request not found',
  );

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
