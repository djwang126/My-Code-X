import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createHttpApp } from './create-http-app.js';
import type { ClientActionResult } from '@my-code-x/contracts-new';
import type { JsonValue } from '@my-code-x/contracts-new/json';
import type { ApplicationService } from '../application/index.js';
import type { HttpRequest } from './http-types.js';

describe('client HTTP workspace actions', () => {
  test('routes open workspace panel without changing payload', async () => {
    await assertRoutesClientAction({
      kind: 'open-workspace-panel',
      scope: createScope({ workspaceId: 'D:\\workspaces\\demo' }),
      payload: {},
    });
  });

  test('routes add workspace without changing payload', async () => {
    await assertRoutesClientAction({
      kind: 'add-workspace',
      scope: createScope({ workspaceId: 'D:\\workspaces\\selected' }),
      payload: {
        cwd: '  D:\\workspaces\\demo  ',
        name: '  Demo  ',
      },
    });
  });

  test('routes rename workspace without changing payload', async () => {
    await assertRoutesClientAction({
      kind: 'rename-workspace',
      scope: createScope({ workspaceId: null }),
      payload: {
        recordRef: 'workspace-record-1',
        currentWorkspaceId: 'D:\\workspaces\\demo',
        name: '',
      },
    });
  });

  test('routes edit workspace cwd without changing payload', async () => {
    await assertRoutesClientAction({
      kind: 'edit-workspace-cwd',
      scope: createScope({ workspaceId: null }),
      payload: {
        recordRef: 'workspace-record-1',
        currentWorkspaceId: 'D:\\workspaces\\demo',
        cwd: '  D:\\workspaces\\renamed  ',
      },
    });
  });

  test('routes remove workspace without changing payload', async () => {
    await assertRoutesClientAction({
      kind: 'remove-workspace',
      scope: createScope({ workspaceId: null }),
      payload: {
        recordRef: 'workspace-record-1',
        currentWorkspaceId: 'D:\\workspaces\\demo',
      },
    });
  });

  test('routes open workspace active threads without changing payload', async () => {
    await assertRoutesClientAction({
      kind: 'open-workspace-active-threads',
      scope: createScope({ workspaceId: 'D:\\workspaces\\demo' }),
      payload: {
        workspaceId: 'D:\\workspaces\\demo',
      },
    });
  });

  test('routes load more workspace active threads without changing payload', async () => {
    await assertRoutesClientAction({
      kind: 'load-more-workspace-active-threads',
      scope: createScope({ workspaceId: 'D:\\workspaces\\demo' }),
      payload: {
        workspaceId: 'D:\\workspaces\\demo',
        cursor: 'next-1',
      },
    });
  });

  test('returns 400 for invalid workspace action payload', async () => {
    const app = createHttpApp({ application: createApplication([]), eventStream: createNoopClientEventStream() });

    const response = await app.handle(createJsonPost({
      kind: 'add-workspace',
      scope: createScope({ workspaceId: null }),
      payload: {
        cwd: 'D:\\workspaces\\demo',
      },
    }));

    assert.deepEqual(response, {
      kind: 'json',
      statusCode: 400,
      headers: {},
      body: {
        error: {
          message: 'Invalid client action',
        },
      },
    });
  });

  test('returns HTTP 200 when application rejects a domain workspace action', async () => {
    const app = createHttpApp({
      application: createApplication([], {
        status: 'rejected',
        error: {
          code: 'missing',
          message: '路径不存在',
        },
      }),
      eventStream: createNoopClientEventStream(),
    });

    const response = await app.handle(createJsonPost({
      kind: 'add-workspace',
      scope: createScope({ workspaceId: null }),
      payload: {
        cwd: 'D:\\workspaces\\missing',
        name: 'Missing',
      },
    }));

    assert.deepEqual(response, createJsonOkResponse({
      status: 'rejected',
      error: {
        code: 'missing',
        message: '路径不存在',
      },
    }));
  });

  test('routes resume thread and preserves accepted snapshot action result shape', async () => {
    const calls: unknown[] = [];
    const result: ClientActionResult = {
      status: 'accepted',
      snapshot: createClientSnapshot(),
      events: [],
      workspacePanel: null,
    };
    const app = createHttpApp({
      application: createApplication(calls, result),
      eventStream: createNoopClientEventStream(),
    });
    const action = {
      kind: 'resume-thread',
      scope: createScope({
        workspaceId: 'D:\\workspaces\\demo',
        threadId: 'thread-2',
      }),
      payload: {},
    };

    const response = await app.handle(createJsonPost(action));

    assert.deepEqual(calls, [action]);
    assert.deepEqual(response, createJsonOkResponse(result));
  });
});

async function assertRoutesClientAction(action: JsonValue): Promise<void> {
  const calls: unknown[] = [];
  const app = createHttpApp({ application: createApplication(calls), eventStream: createNoopClientEventStream() });

  const response = await app.handle(createJsonPost(action));

  assert.deepEqual(calls, [action]);
  assert.deepEqual(response, createJsonOkResponse(createAcceptedResult()));
}

function createApplication(calls: unknown[], result: ClientActionResult = createAcceptedResult()): ApplicationService {
  return {
    async openClient() {
      throw new Error('openClient is outside this test');
    },
    async sendClientMessage() {
      throw new Error('sendClientMessage is outside this test');
    },
    async resumeClientThread(input) {
      calls.push(input);
      return result;
    },
    async respondClientInteraction() {
      throw new Error('respondClientInteraction is outside this test');
    },
    async interruptClientTurn() {
      throw new Error('interruptClientTurn is outside this test');
    },
    async openWorkspacePanel(input) {
      calls.push(input);
      return result;
    },
    async openWorkspaceActiveThreads(input) {
      calls.push(input);
      return result;
    },
    async loadMoreWorkspaceActiveThreads(input) {
      calls.push(input);
      return result;
    },
    async addWorkspace(input) {
      calls.push(input);
      return result;
    },
    async renameWorkspace(input) {
      calls.push(input);
      return result;
    },
    async editWorkspaceCwd(input) {
      calls.push(input);
      return result;
    },
    async removeWorkspace(input) {
      calls.push(input);
      return result;
    },
  };
}

function createAcceptedResult(): ClientActionResult {
  return {
    status: 'accepted' as const,
    snapshot: null,
    events: [],
    workspacePanel: {
      status: 'ready' as const,
      list: {
        persistence: {
          status: 'persistent' as const,
        },
        selectedWorkspaceId: null,
        items: [],
      },
      page: {
        kind: 'workspace-list' as const,
      },
    },
  };
}

function createJsonOkResponse(body: JsonValue) {
  return {
    kind: 'json',
    statusCode: 200,
    headers: {},
    body,
  };
}

interface CreateScopeInput {
  readonly workspaceId: string | null;
  readonly threadId?: string | null;
}

function createScope(input: CreateScopeInput) {
  return {
    slotId: 'slot-1',
    workspaceId: input.workspaceId,
    threadId: input.threadId ?? null,
  };
}

function createClientSnapshot() {
  return {
    app: {
      status: 'ready' as const,
    },
    identity: {
      slotId: 'slot-1',
    },
    selection: {
      workspaceId: 'D:\\workspaces\\demo',
      threadId: 'thread-2',
    },
    workspace: {
      status: 'selected' as const,
    },
    thread: {
      status: 'ready' as const,
      title: 'Second thread',
    },
    turn: {
      current: null,
    },
    conversation: {
      status: 'ready' as const,
      revision: 1,
      items: [],
    },
    pendingInteractions: [],
    notices: [],
    capabilities: {
      actions: [],
      options: {},
    },
    stream: {
      status: 'disabled' as const,
      revision: 'resume-1',
    },
  };
}

function createJsonPost(body: JsonValue): HttpRequest {
  return {
    method: 'POST',
    path: '/client',
    query: {},
    headers: {
      'content-type': 'application/json',
    },
    body,
    rawBody: JSON.stringify(body),
    signal: new globalThis.AbortController().signal,
  };
}

function createNoopClientEventStream() {
  return {
    subscribe() {
      return () => {};
    },
  };
}
