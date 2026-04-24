import test from 'node:test';
import assert from 'node:assert/strict';

import { createChatService } from '../index.js';

test('pending server requests can be submitted, marked in-flight, and cleared when resolved', async () => {
  const responses = [];
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
      async respondToRequest({ requestId, response }) {
        responses.push({ requestId, response });
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
    text: 'run checks',
  });

  service.applyGatewayEvent({
    type: 'pending_request_updated',
    threadId: 'thread-1',
    request: {
      id: 'req-1',
      method: 'item/commandExecution/requestApproval',
      kind: 'command_approval',
      threadId: 'thread-1',
      turnId: 'turn-1',
      itemId: 'cmd-1',
      title: 'Approve command execution',
      prompt: 'npm test',
      command: 'npm test',
      cwd: 'D:/workspace/example-app',
      submitState: 'idle',
      raw: {
        threadId: 'thread-1',
        turnId: 'turn-1',
        itemId: 'cmd-1',
      },
    },
  });

  assert.deepEqual(service.getSessionState({ slotId: 'tab-1', threadId: 'thread-1' })?.pendingRequests, [
    {
      id: 'req-1',
      method: 'item/commandExecution/requestApproval',
      kind: 'command_approval',
      threadId: 'thread-1',
      turnId: 'turn-1',
      itemId: 'cmd-1',
      title: 'Approve command execution',
      prompt: 'npm test',
      command: 'npm test',
      cwd: 'D:/workspace/example-app',
      submitState: 'idle',
      raw: {
        threadId: 'thread-1',
        turnId: 'turn-1',
        itemId: 'cmd-1',
      },
    },
  ]);

  await service.respondToPendingRequest({
    slotId: 'tab-1',
    threadId: 'thread-1',
    requestId: 'req-1',
    response: {
      decision: 'accept',
    },
  });

  assert.deepEqual(responses, [
    {
      requestId: 'req-1',
      response: {
        decision: 'accept',
      },
    },
  ]);
  assert.equal(
    service.getSessionState({ slotId: 'tab-1', threadId: 'thread-1' })?.pendingRequests[0]?.submitState,
    'submitting',
  );

  service.applyGatewayEvent({
    type: 'pending_request_resolved',
    threadId: 'thread-1',
    requestId: 'req-1',
    notice: {
      id: 'serverRequest/resolved:req-1',
      level: 'info',
      title: 'Request resolved',
      text: 'Resolved request req-1',
      raw: {
        threadId: 'thread-1',
        requestId: 'req-1',
      },
    },
  });

  assert.deepEqual(service.getSessionState({ slotId: 'tab-1', threadId: 'thread-1' })?.pendingRequests, []);
  assert.deepEqual(service.getSessionState({ slotId: 'tab-1', threadId: 'thread-1' })?.notices, [
    {
      id: 'serverRequest/resolved:req-1',
      level: 'info',
      title: 'Request resolved',
      text: 'Resolved request req-1',
      raw: {
        threadId: 'thread-1',
        requestId: 'req-1',
      },
    },
  ]);
  assert.deepEqual(events, [
    {
      type: 'turn_started',
      threadId: 'thread-1',
      latestTurn: {
        id: 'turn-1',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
    },
    {
      type: 'pending_request_updated',
      threadId: 'thread-1',
      request: {
        id: 'req-1',
        method: 'item/commandExecution/requestApproval',
        kind: 'command_approval',
        threadId: 'thread-1',
        turnId: 'turn-1',
        itemId: 'cmd-1',
        title: 'Approve command execution',
        prompt: 'npm test',
        command: 'npm test',
        cwd: 'D:/workspace/example-app',
        submitState: 'idle',
        raw: {
          threadId: 'thread-1',
          turnId: 'turn-1',
          itemId: 'cmd-1',
        },
      },
    },
    {
      type: 'pending_request_updated',
      threadId: 'thread-1',
      request: {
        id: 'req-1',
        method: 'item/commandExecution/requestApproval',
        kind: 'command_approval',
        threadId: 'thread-1',
        turnId: 'turn-1',
        itemId: 'cmd-1',
        title: 'Approve command execution',
        prompt: 'npm test',
        command: 'npm test',
        cwd: 'D:/workspace/example-app',
        submitState: 'submitting',
        raw: {
          threadId: 'thread-1',
          turnId: 'turn-1',
          itemId: 'cmd-1',
        },
      },
    },
    {
      type: 'pending_request_resolved',
      threadId: 'thread-1',
      requestId: 'req-1',
      notice: {
        id: 'serverRequest/resolved:req-1',
        level: 'info',
        title: 'Request resolved',
        text: 'Resolved request req-1',
        raw: {
          threadId: 'thread-1',
          requestId: 'req-1',
        },
      },
    },
  ]);
});

