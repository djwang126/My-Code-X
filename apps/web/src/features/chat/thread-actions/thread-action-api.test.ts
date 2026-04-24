import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import {
  postThreadResume,
  postThreadStart,
  postThreadCompactStart,
  postThreadFork,
  postThreadRollback,
} from './thread-action-api';

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('thread action api', () => {
  it('posts start requests and parses the started snapshot payload', async () => {
    let requestBody: Record<string, unknown> | null = null;

    server.use(
      http.post('/api/v2/thread/start', async ({ request }) => {
        requestBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          kind: 'threadStarted',
          threadId: 'thread-22',
          snapshot: {
            threadId: 'thread-22',
            latestTurn: null,
            messages: [],
            notices: [],
            pendingRequests: [],
            lastError: null,
          },
        });
      }),
    );

    const payload = await postThreadStart({
      viewerId: 'viewer-1',
      slotId: 'tab-5',
      workspace: 'D:/workspaces/My-Code-X',
      runtimeSettings: { promptOverride: 'normal' },
    });

    expect(requestBody).toEqual({
      viewerId: 'viewer-1',
      slotId: 'tab-5',
      workspace: 'D:/workspaces/My-Code-X',
      runtimeSettings: { promptOverride: 'normal' },
    });
    expect(payload).toEqual({
      kind: 'threadStarted',
      threadId: 'thread-22',
      snapshot: {
        threadId: 'thread-22',
        latestTurn: null,
        messages: [],
        notices: [],
        pendingRequests: [],
        lastError: null,
      },
    });
  });

  it('posts resume requests and parses the resumed snapshot payload', async () => {
    let requestBody: Record<string, unknown> | null = null;

    server.use(
      http.post('/api/v2/thread/resume', async ({ request }) => {
        requestBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          kind: 'threadResumed',
          threadId: 'thread-22',
          snapshot: {
            threadId: 'thread-22',
            latestTurn: null,
            messages: [],
            notices: [],
            pendingRequests: [],
            lastError: null,
          },
        });
      }),
    );

    const payload = await postThreadResume({
      viewerId: 'viewer-1',
      slotId: 'tab-5',
      threadId: 'thread-22',
      workspace: 'D:/workspaces/My-Code-X',
      runtimeSettings: { promptOverride: 'normal' },
    });

    expect(requestBody).toEqual({
      viewerId: 'viewer-1',
      slotId: 'tab-5',
      threadId: 'thread-22',
      workspace: 'D:/workspaces/My-Code-X',
      runtimeSettings: { promptOverride: 'normal' },
    });
    expect(payload).toEqual({
      kind: 'threadResumed',
      threadId: 'thread-22',
      snapshot: {
        threadId: 'thread-22',
        latestTurn: null,
        messages: [],
        notices: [],
        pendingRequests: [],
        lastError: null,
      },
    });
  });

  it('posts compact requests and parses the compact-started payload', async () => {
    let requestBody: Record<string, unknown> | null = null;

    server.use(
      http.post('/api/v2/thread/compact', async ({ request }) => {
        requestBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          kind: 'threadCompactStarted',
          threadId: 'thread-22',
        });
      }),
    );

    const payload = await postThreadCompactStart({
      slotId: 'tab-5',
      threadId: 'thread-22',
      workspace: 'D:/workspaces/My-Code-X',
    });

    expect(requestBody).toEqual({
      slotId: 'tab-5',
      threadId: 'thread-22',
      workspace: 'D:/workspaces/My-Code-X',
    });
    expect(payload).toEqual({
      kind: 'threadCompactStarted',
      threadId: 'thread-22',
    });
  });

  it('posts fork requests and parses the forked snapshot payload', async () => {
    let requestBody: Record<string, unknown> | null = null;

    server.use(
      http.post('/api/v2/thread/fork', async ({ request }) => {
        requestBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          kind: 'threadForked',
          sourceThreadId: 'thread-22',
          threadId: 'thread-forked',
          snapshot: {
            threadId: 'thread-forked',
            latestTurn: null,
            messages: [],
            notices: [],
            pendingRequests: [],
            lastError: null,
          },
        });
      }),
    );

    const payload = await postThreadFork({
      slotId: 'tab-5',
      threadId: 'thread-22',
      workspace: 'D:/workspaces/My-Code-X',
      preservedTurnCount: 2,
    });

    expect(requestBody).toEqual({
      slotId: 'tab-5',
      threadId: 'thread-22',
      workspace: 'D:/workspaces/My-Code-X',
      preservedTurnCount: 2,
    });
    expect(payload).toEqual({
      kind: 'threadForked',
      sourceThreadId: 'thread-22',
      threadId: 'thread-forked',
      snapshot: {
        threadId: 'thread-forked',
        latestTurn: null,
        messages: [],
        notices: [],
        pendingRequests: [],
        lastError: null,
      },
    });
  });

  it('posts rollback requests and parses the rolled-back snapshot payload', async () => {
    let requestBody: Record<string, unknown> | null = null;

    server.use(
      http.post('/api/v2/thread/rollback', async ({ request }) => {
        requestBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          kind: 'threadRolledBack',
          threadId: 'thread-22',
          snapshot: {
            threadId: 'thread-22',
            latestTurn: null,
            messages: [],
            notices: [],
            pendingRequests: [],
            lastError: null,
          },
        });
      }),
    );

    const payload = await postThreadRollback({
      slotId: 'tab-5',
      threadId: 'thread-22',
      workspace: 'D:/workspaces/My-Code-X',
      numTurns: 1,
    });

    expect(requestBody).toEqual({
      slotId: 'tab-5',
      threadId: 'thread-22',
      workspace: 'D:/workspaces/My-Code-X',
      numTurns: 1,
    });
    expect(payload).toEqual({
      kind: 'threadRolledBack',
      threadId: 'thread-22',
      snapshot: {
        threadId: 'thread-22',
        latestTurn: null,
        messages: [],
        notices: [],
        pendingRequests: [],
        lastError: null,
      },
    });
  });

  it('rejects mismatched compact response kinds', async () => {
    server.use(
      http.post('/api/v2/thread/compact', () =>
        HttpResponse.json({
          kind: 'threadRolledBack',
          threadId: 'thread-22',
          snapshot: {
            threadId: 'thread-22',
            latestTurn: null,
            messages: [],
          },
        }),
      ),
    );

    await expect(
      postThreadCompactStart({
        slotId: 'tab-5',
        threadId: 'thread-22',
        workspace: 'D:/workspaces/My-Code-X',
      }),
    ).rejects.toThrowError('thread compact response kind mismatch.');
  });
});
