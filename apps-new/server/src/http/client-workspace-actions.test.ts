import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createHttpApp } from './create-http-app.js';
import type { ClientActionResult } from '@my-code-x/contracts-new';
import type { JsonValue } from '@my-code-x/contracts-new/json';
import type { ApplicationService } from '../application/index.js';
import type { HttpRequest } from './http-types.js';

describe('client HTTP workspace actions', () => {
  test('dispatches workspace client actions to the matching application use case without changing payloads', async () => {
    const actions = [
      {
        kind: 'open-workspace-panel',
        scope: createScope({ workspaceId: 'D:\\workspaces\\demo' }),
        payload: {},
      },
      {
        kind: 'add-workspace',
        scope: createScope({ workspaceId: 'D:\\workspaces\\selected' }),
        payload: {
          cwd: '  D:\\workspaces\\demo  ',
          name: '  Demo  ',
        },
      },
      {
        kind: 'rename-workspace',
        scope: createScope({ workspaceId: null }),
        payload: {
          recordRef: 'workspace-record-1',
          currentWorkspaceId: 'D:\\workspaces\\demo',
          name: '',
        },
      },
      {
        kind: 'edit-workspace-cwd',
        scope: createScope({ workspaceId: null }),
        payload: {
          recordRef: 'workspace-record-1',
          currentWorkspaceId: 'D:\\workspaces\\demo',
          cwd: '  D:\\workspaces\\renamed  ',
        },
      },
      {
        kind: 'remove-workspace',
        scope: createScope({ workspaceId: null }),
        payload: {
          recordRef: 'workspace-record-1',
          currentWorkspaceId: 'D:\\workspaces\\demo',
        },
      },
    ] as const;

    for (const action of actions) {
      const calls: unknown[] = [];
      const app = createHttpApp({ application: createApplication(calls), eventStream: createNoopClientEventStream() });

      const response = await app.handle(createJsonPost(action));

      assert.deepEqual(calls, [action]);
      assert.deepEqual(response, createJsonOkResponse(createAcceptedResult()));
    }
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
});

function createApplication(calls: unknown[], result: ClientActionResult = createAcceptedResult()): ApplicationService {
  return {
    async openClient() {
      throw new Error('openClient is outside this test');
    },
    async sendClientMessage() {
      throw new Error('sendClientMessage is outside this test');
    },
    async resumeClientThread() {
      throw new Error('resumeClientThread is outside this test');
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
}

function createScope(input: CreateScopeInput) {
  return {
    slotId: 'slot-1',
    workspaceId: input.workspaceId,
    threadId: null,
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
