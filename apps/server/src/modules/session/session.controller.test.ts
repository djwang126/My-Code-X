import test from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../../app/app.js';
import { withServer } from '../../common/testing/http-test-helpers.js';

test('GET /api/v2/session returns the runtime-backed bootstrap payload', async () => {
  const calls = [];
  const app = createApp({
    authToken: 'session-auth',
    serverInstanceId: 'session-instance',
    chatService: {
      async hydrateSession({ viewerId, slotId, workspace, threadId }) {
        calls.push({ viewerId, slotId, workspace, threadId });
        return {
          workspace: 'D:/workspaces/My-Code-X',
          threadId: 'thread-9',
          turnExecution: {
            activeTurnId: null,
            turnLifecycle: 'idle',
          },
          collaborationModeKind: 'plan',
          appliedThreadRuntimeOverrides: {
            promptOverride: 'normal',
          },
          lastUpdatedAt: '2026-04-03T12:00:00.000Z',
          messages: [
            {
              id: 'user:turn-9',
              role: 'user',
              text: 'restored prompt',
              state: 'complete',
              threadId: 'thread-9',
              turnId: 'turn-9',
            },
            {
              id: 'assistant:turn-9',
              role: 'assistant',
              text: 'restored answer',
              state: 'complete',
              threadId: 'thread-9',
              turnId: 'turn-9',
            },
          ],
        };
      },
      getPreferences() {
        return {
          model: 'gpt-5.1-codex',
          reasoningEffort: 'medium',
          approvalPolicy: 'never',
          sandboxMode: 'danger-full-access',
          promptOverride: 'normal',
        };
      },
      getOptions() {
        return {
          models: [
            {
              value: 'gpt-5.1-codex',
              label: 'GPT-5.1 Codex',
              description: 'Default coding model',
              reasoningEfforts: [
                { value: 'medium', label: 'Medium', description: 'Balanced' },
                { value: 'high', label: 'High', description: 'More reasoning' },
              ],
              defaultReasoningEffort: 'medium',
            },
          ],
          approvalPolicies: [{ value: 'never', label: 'Never', description: 'Never ask' }],
          sandboxModes: [{ value: 'danger-full-access', label: 'Danger full access', description: 'Full access' }],
          collaborationModes: [
            { kind: 'plan', label: 'Plan', model: null, reasoningEffort: 'medium' },
            { kind: 'default', label: 'Default', model: null, reasoningEffort: null },
          ],
          promptOverrides: [
            { value: 'normal', label: 'normal', description: '' },
            { value: 'cat', label: 'cat', description: '' },
          ],
        };
      },
    },
  });

  await withServer(app, async ({ port }) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/v2/session?viewerId=viewer-1&slotId=tab-1&workspace=D:/workspaces/My-Code-X&threadId=thread-9`, {
      headers: { Authorization: 'Bearer session-auth' },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(calls, [
      {
        viewerId: 'viewer-1',
        slotId: 'tab-1',
        workspace: 'D:/workspaces/My-Code-X',
        threadId: 'thread-9',
      },
    ]);
    assert.deepEqual(body, {
      server: { ok: true, serverInstanceId: 'session-instance', authRequired: true },
      viewer: { viewerId: 'viewer-1', slotId: 'tab-1' },
      session: {
        workspace: 'D:/workspaces/My-Code-X',
        threadId: 'thread-9',
        turnExecution: {
          activeTurnId: null,
          turnLifecycle: 'idle',
        },
        collaborationModeKind: 'plan',
        promptOverride: 'normal',
        lastUpdatedAt: '2026-04-03T12:00:00.000Z',
      },
      conversation: {
        messages: [
          {
            id: 'user:turn-9',
            role: 'user',
            text: 'restored prompt',
            state: 'complete',
            threadId: 'thread-9',
            turnId: 'turn-9',
          },
          {
            id: 'assistant:turn-9',
            role: 'assistant',
            text: 'restored answer',
            state: 'complete',
            threadId: 'thread-9',
            turnId: 'turn-9',
          },
        ],
      },
      stream: {
        url: '/api/v2/chat/events?slotId=tab-1&threadId=thread-9',
      },
      preferences: {
        model: 'gpt-5.1-codex',
        reasoningEffort: 'medium',
        approvalPolicy: 'never',
        sandboxMode: 'danger-full-access',
        promptOverride: 'normal',
      },
      options: {
        models: [
          {
            value: 'gpt-5.1-codex',
            label: 'GPT-5.1 Codex',
            description: 'Default coding model',
            reasoningEfforts: [
              { value: 'medium', label: 'Medium', description: 'Balanced' },
              { value: 'high', label: 'High', description: 'More reasoning' },
            ],
            defaultReasoningEffort: 'medium',
          },
        ],
        approvalPolicies: [{ value: 'never', label: 'Never', description: 'Never ask' }],
        sandboxModes: [{ value: 'danger-full-access', label: 'Danger full access', description: 'Full access' }],
        collaborationModes: [
          { kind: 'plan', label: 'Plan', model: null, reasoningEffort: 'medium' },
          { kind: 'default', label: 'Default', model: null, reasoningEffort: null },
        ],
        promptOverrides: [
          { value: 'normal', label: 'normal', description: '' },
          { value: 'cat', label: 'cat', description: '' },
        ],
      },
    });
  });
});

test('GET /api/v2/session returns cleared thread prompt override metadata when the resumed thread explicitly uses none', async () => {
  const app = createApp({
    authToken: 'session-auth',
    serverInstanceId: 'session-instance',
    chatService: {
      async hydrateSession() {
        return {
          workspace: 'D:/workspaces/My-Code-X',
          threadId: 'thread-10',
          turnExecution: {
            activeTurnId: null,
            turnLifecycle: 'idle',
          },
          appliedThreadRuntimeOverrides: {
            promptOverride: null,
          },
          lastUpdatedAt: '2026-04-03T12:00:00.000Z',
          messages: [],
          notices: [],
          pendingRequests: [],
          threadName: '',
          threadStatusText: '',
          tokenUsageText: '',
        };
      },
      getPreferences() {
        return {
          model: 'gpt-5.1-codex',
          reasoningEffort: 'medium',
          approvalPolicy: 'never',
          sandboxMode: 'danger-full-access',
          promptOverride: 'cat',
        };
      },
      getOptions() {
        return {
          models: [],
          approvalPolicies: [],
          sandboxModes: [],
          collaborationModes: [],
          promptOverrides: [
            { value: 'normal', label: 'normal', description: '' },
            { value: 'cat', label: 'cat', description: '' },
          ],
        };
      },
    },
  });

  await withServer(app, async ({ port }) => {
    const response = await fetch(
      `http://127.0.0.1:${port}/api/v2/session?viewerId=viewer-1&slotId=tab-1&workspace=D:/workspaces/My-Code-X&threadId=thread-10`,
      {
        headers: { Authorization: 'Bearer session-auth' },
      },
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.session.promptOverride, null);
    assert.equal(body.preferences.promptOverride, 'cat');
  });
});

test('GET /api/v2/session omits large command and file-change bodies from the bootstrap transcript payload', async () => {
  const commandOutput = Array.from({ length: 12 }, (_, index) => `command line ${index + 1}`).join('\n');
  const fileChangeOutput = Array.from({ length: 12 }, (_, index) => `file line ${index + 1}`).join('\n');
  const app = createApp({
    authToken: 'session-auth',
    serverInstanceId: 'session-instance',
    chatService: {
      async hydrateSession() {
        return {
          workspace: 'D:/workspaces/My-Code-X',
          threadId: 'thread-9',
          turnExecution: {
            activeTurnId: null,
            turnLifecycle: 'idle',
          },
          lastUpdatedAt: '2026-04-03T12:00:00.000Z',
          messages: [
            {
              id: 'cmd-1',
              kind: 'special',
              itemType: 'commandExecution',
              text: 'npm test',
              state: 'complete',
              threadId: 'thread-9',
              turnId: 'turn-9',
              raw: {
                type: 'commandExecution',
                id: 'cmd-1',
                command: 'npm test',
                aggregatedOutput: commandOutput,
              },
            },
            {
              id: 'file-1',
              kind: 'special',
              itemType: 'fileChange',
              text: 'src/app.tsx',
              state: 'complete',
              threadId: 'thread-9',
              turnId: 'turn-9',
              raw: {
                type: 'fileChange',
                id: 'file-1',
                changes: [{ path: 'src/app.tsx', kind: 'update' }],
                output: fileChangeOutput,
              },
            },
          ],
          notices: [],
          pendingRequests: [],
          threadName: '',
          threadStatusText: '',
          tokenUsageText: '',
        };
      },
      getPreferences() {
        return {};
      },
      getOptions() {
        return {};
      },
    },
  });

  await withServer(app, async ({ port }) => {
    const response = await fetch(
      `http://127.0.0.1:${port}/api/v2/session?viewerId=viewer-1&slotId=tab-1&workspace=D:/workspaces/My-Code-X&threadId=thread-9`,
      {
        headers: { Authorization: 'Bearer session-auth' },
      },
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.conversation.messages.length, 2);

    const [commandMessage, fileMessage] = body.conversation.messages;

      assert.deepEqual(commandMessage, {
        id: 'cmd-1',
        kind: 'special',
        itemType: 'commandExecution',
        text: '',
        state: 'complete',
        threadId: 'thread-9',
        turnId: 'turn-9',
        raw: {
          type: 'commandExecution',
          id: 'cmd-1',
          detailRevision: commandMessage.raw.detailRevision,
          detailAvailable: true,
        },
      });

      assert.deepEqual(fileMessage, {
        id: 'file-1',
        kind: 'special',
        itemType: 'fileChange',
        text: '',
        state: 'complete',
        threadId: 'thread-9',
        turnId: 'turn-9',
        raw: {
          type: 'fileChange',
          id: 'file-1',
          detailRevision: fileMessage.raw.detailRevision,
          detailAvailable: true,
        },
      });
  });
});

test('GET /api/v2/session returns 400 when slotId is missing', async () => {
  const app = createApp({
    authToken: 'session-auth',
    serverInstanceId: 'session-instance',
    chatService: {
      async hydrateSession() {
        throw new Error('hydrateSession should not be called');
      },
    },
  });

  await withServer(app, async ({ port }) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/v2/session?viewerId=viewer-1`, {
      headers: { Authorization: 'Bearer session-auth' },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.deepEqual(body, { error: { code: 'slotid_is_required', message: 'slotId is required', status: 400 } });
  });
});

test('GET /api/v2/session preserves the raw runtime error text', async () => {
  const app = createApp({
    authToken: 'session-auth',
    serverInstanceId: 'session-instance',
    chatService: {
      async hydrateSession() {
        throw new Error('thread/resume failed: thread not found');
      },
    },
  });

  await withServer(app, async ({ port }) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/v2/session?viewerId=viewer-1&slotId=tab-1&workspace=D:/workspaces/My-Code-X&threadId=missing-thread`, {
      headers: { Authorization: 'Bearer session-auth' },
    });
    const body = await response.json();

    assert.equal(response.status, 502);
    assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
    assert.deepEqual(body, {
      error: {
        code: 'thread_resume_failed_thread_not_found',
        message: 'thread/resume failed: thread not found',
        status: 502,
      },
    });
  });
});
