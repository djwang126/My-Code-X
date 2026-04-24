import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import { SessionApiError } from '../../../shared/lib/app-api-client';
import { fetchSessionPayload } from './api/session-bootstrap-api';
import { postServerRequestResponse } from './api/session-request-api';
import { postChatInterrupt, postChatMessage } from './api/chat-turn-api';
import { fetchTimelineItemContent } from '../transcript';
import { fetchWorkspaceThreads } from '../../workspace/threads';
import { requestAppRestart, waitForAppReady } from '../../tools/restart';
import { postReviewStart } from '../../tools/review';
import { fetchWorkspaceFile, fetchWorkspaceFiles, postWorkspaceFileSave } from '../../workspace/explorer';

const server = setupServer(
  http.get('/api/v2/session', ({ request }) => {
    const url = new URL(request.url);
    return HttpResponse.json({
      server: { ok: true, serverInstanceId: 'session-api-test', authRequired: false },
      viewer: {
        viewerId: url.searchParams.get('viewerId'),
        slotId: url.searchParams.get('slotId'),
      },
      session: {
        workspace: url.searchParams.get('workspace') || '',
        threadId: url.searchParams.get('threadId') || '',
        latestTurn: null,
        lastUpdatedAt: '2026-04-03T12:34:56.000Z',
      },
      conversation: {
        messages: [],
      },
      stream: {
        url: '',
      },
      preferences: {},
      options: {},
    });
  }),
  http.get('/api/v2/thread/history', ({ request }) => {
    const url = new URL(request.url);
    return HttpResponse.json({
      data: [
        {
          id: 'thread-7',
          name: 'Sidebar work',
          preview: 'Adjust sidebar layout',
          workspace: url.searchParams.get('workspace') || '',
          createdAt: 1_744_000_000,
          updatedAt: 1_744_000_500,
          statusText: 'idle',
        },
      ],
    });
  }),
  http.get('/api/v2/workspace/files', ({ request }) => {
    const url = new URL(request.url);
    return HttpResponse.json({
      data: [
        {
          path: url.searchParams.get('path') ? `${url.searchParams.get('path')}/guide.md` : 'guide.md',
          name: 'guide.md',
          kind: 'file',
          size: 12,
          ext: '.md',
          contentKind: 'text',
          isLarge: false,
        },
      ],
    });
  }),
  http.get('/api/v2/workspace/file', ({ request }) => {
    const url = new URL(request.url);
    return HttpResponse.json({
      kind: 'text',
      path: url.searchParams.get('path') || 'guide.md',
      name: 'guide.md',
      size: 12,
      encoding: 'utf-8',
      content: '# hello\n',
      truncated: false,
    });
  }),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('fetchSessionPayload', () => {
  it('requests the typed session bootstrap payload with viewer, slot, and thread identity', async () => {
    const payload = await fetchSessionPayload({
      viewerId: 'viewer-22',
      slotId: 'tab-5',
      workspace: 'D:/workspaces/My-Code-X',
      threadId: 'thread-7',
    });

    expect(payload.viewer.viewerId).toBe('viewer-22');
    expect(payload.viewer.slotId).toBe('tab-5');
    expect(payload.session.workspace).toBe('D:/workspaces/My-Code-X');
    expect(payload.session.threadId).toBe('thread-7');
    expect(payload.session.latestTurn?.id).toBeNull();
    expect(payload.conversation.messages).toEqual([]);
  });

  it('rejects bootstrap payloads that omit latestTurn?.status', async () => {
    server.use(
      http.get('/api/v2/session', () =>
        HttpResponse.json({
          server: { ok: true, serverInstanceId: 'session-api-test', authRequired: false },
          viewer: { viewerId: 'viewer-22', slotId: 'tab-5' },
          session: {
            workspace: '',
            threadId: '',
            latestTurn: {
              turnId: null,
            },
            lastUpdatedAt: '2026-04-03T12:34:56.000Z',
          },
          conversation: {
            messages: [],
          },
          stream: {
            url: '',
          },
          preferences: {},
          options: {},
        }),
      ),
    );

    await expect(fetchSessionPayload({ viewerId: 'viewer-22', slotId: 'tab-5', workspace: '', threadId: '' })).rejects.toThrowError(
      'session payload.session.latestTurn?.status must be one of idle, running, interrupting, completed, interrupted, or failed.',
    );
  });

  it('maps 401 responses to SessionApiError', async () => {
    server.use(
      http.get('/api/v2/session', () =>
        HttpResponse.json({
          error: {
            code: 'unauthorized',
            message: 'unauthorized',
            status: 401,
          },
        }, { status: 401 }),
      ),
    );

    await expect(fetchSessionPayload({ viewerId: 'viewer-22', slotId: 'tab-5', workspace: '', threadId: '' })).rejects.toMatchObject({
      name: 'SessionApiError',
      code: 'unauthorized',
      status: 401,
      message: 'unauthorized',
    } satisfies Partial<SessionApiError>);
  });

  it('returns the raw backend text for non-OK responses', async () => {
    server.use(
      http.get('/api/v2/session', () =>
        new HttpResponse('thread/resume failed: thread not found', {
          status: 502,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        }),
      ),
    );

    await expect(
      fetchSessionPayload({
        viewerId: 'viewer-22',
        slotId: 'tab-5',
        workspace: 'D:/workspaces/My-Code-X',
        threadId: 'thread-missing',
      }),
    ).rejects.toThrowError('thread/resume failed: thread not found');
  });
});

describe('fetchWorkspaceThreads', () => {
  it('requests workspace-scoped workspace threads', async () => {
    const history = await fetchWorkspaceThreads({
      workspace: 'D:/workspaces/My-Code-X',
      limit: 12,
    });

    expect(history).toEqual([
      {
        id: 'thread-7',
        name: 'Sidebar work',
        preview: 'Adjust sidebar layout',
        workspace: 'D:/workspaces/My-Code-X',
        createdAt: 1_744_000_000,
        updatedAt: 1_744_000_500,
        statusText: 'idle',
      },
    ]);
  });

  it('returns the raw backend text when workspace threads fails', async () => {
    server.use(
      http.get('/api/v2/thread/history', () =>
        new HttpResponse('thread/list failed', {
          status: 502,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        }),
      ),
    );

    await expect(fetchWorkspaceThreads({ workspace: 'D:/workspaces/My-Code-X' })).rejects.toThrowError(
      'thread/list failed',
    );
  });
});

  describe('fetchTimelineItemContent', () => {
    it('requests full timeline item details on demand', async () => {
      server.use(
        http.get('/api/v2/chat/item-content', ({ request }) => {
          const url = new URL(request.url);
          return HttpResponse.json({
            itemId: url.searchParams.get('itemId'),
            itemType: 'commandExecution',
            detailRevision: 'rev-1',
            raw: {
              type: 'commandExecution',
              id: url.searchParams.get('itemId'),
              command: 'npm test',
              aggregatedOutput: 'line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nline 8\nline 9\nline 10\nline 11',
            },
          });
        }),
      );

      const payload = await fetchTimelineItemContent({
        slotId: 'tab-5',
        threadId: 'thread-22',
        itemId: 'cmd-1',
      });

      expect(payload).toEqual({
        itemId: 'cmd-1',
        itemType: 'commandExecution',
        detailRevision: 'rev-1',
        raw: {
          type: 'commandExecution',
          id: 'cmd-1',
          command: 'npm test',
          aggregatedOutput: 'line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nline 8\nline 9\nline 10\nline 11',
        },
      });
    });

    it('returns the raw backend text when full timeline detail fetch fails', async () => {
      server.use(
        http.get('/api/v2/chat/item-content', () =>
          new HttpResponse('timeline item not found', {
          status: 404,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        }),
      ),
    );

      await expect(
        fetchTimelineItemContent({
          slotId: 'tab-5',
          threadId: 'thread-22',
          itemId: 'cmd-1',
        }),
      ).rejects.toThrowError('timeline item not found');
    });
  });

describe('fetchWorkspaceFiles', () => {
  it('requests workspace-relative directory entries', async () => {
    const entries = await fetchWorkspaceFiles({
      workspace: 'D:/workspaces/My-Code-X',
      path: 'docs',
    });

    expect(entries).toEqual([
      {
        path: 'docs/guide.md',
        name: 'guide.md',
        kind: 'file',
        size: 12,
        ext: '.md',
        contentKind: 'text',
        isLarge: false,
      },
    ]);
  });

  it('returns the raw backend text when listing files fails', async () => {
    server.use(
      http.get('/api/v2/workspace/files', () =>
        new HttpResponse('workspace/list failed', {
          status: 502,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        }),
      ),
    );

    await expect(
      fetchWorkspaceFiles({
        workspace: 'D:/workspaces/My-Code-X',
        path: '',
      }),
    ).rejects.toThrowError('workspace/list failed');
  });
});

describe('fetchWorkspaceFile', () => {
  it('requests editable file content', async () => {
    const file = await fetchWorkspaceFile({
      workspace: 'D:/workspaces/My-Code-X',
      path: 'docs/guide.md',
    });

    expect(file).toEqual({
      kind: 'text',
      path: 'docs/guide.md',
      name: 'guide.md',
      size: 12,
      encoding: 'utf-8',
      content: '# hello\n',
      truncated: false,
    });
  });
});

describe('postChatMessage', () => {
  it('posts trimmed text and omits an empty thread id', async () => {
    let requestBody: Record<string, unknown> | null = null;

    server.use(
      http.post('/api/v2/chat/message', async ({ request }) => {
        requestBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          threadId: 'thread-22',
          latestTurn: {
        id: 'turn-9',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
          stream: {
            url: '/api/v2/chat/events?slotId=tab-5&threadId=thread-22',
          },
        });
      }),
    );

    const payload = await postChatMessage({
      viewerId: 'viewer-22',
      slotId: 'tab-5',
      workspace: 'D:/workspaces/My-Code-X',
      threadId: '',
      text: '  Explain this bug  ',
      runtimeSettings: {
        model: 'gpt-5.4',
        reasoningEffort: 'high',
        approvalPolicy: 'on-request',
        sandboxMode: 'workspace-write',
        collaborationModeKind: 'default',
        modelContextWindow: 200000,
        modelAutoCompactTokenLimit: 150000,
      },
    });

    expect(requestBody).toEqual({
      viewerId: 'viewer-22',
      slotId: 'tab-5',
      workspace: 'D:/workspaces/My-Code-X',
      text: 'Explain this bug',
      runtimeSettings: {
        model: 'gpt-5.4',
        reasoningEffort: 'high',
        approvalPolicy: 'on-request',
        sandboxMode: 'workspace-write',
        collaborationModeKind: 'default',
        modelContextWindow: 200000,
        modelAutoCompactTokenLimit: 150000,
      },
    });
    expect(payload).toEqual({
      threadId: 'thread-22',
      latestTurn: {
        id: 'turn-9',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
      stream: {
        url: '/api/v2/chat/events?slotId=tab-5&threadId=thread-22',
      },
    });
  });

  it('includes thread id when continuing the same thread', async () => {
    let requestBody: Record<string, unknown> | null = null;

    server.use(
      http.post('/api/v2/chat/message', async ({ request }) => {
        requestBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          threadId: 'thread-22',
          latestTurn: {
        id: 'turn-10',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
          stream: {
            url: '/api/v2/chat/events?slotId=tab-5&threadId=thread-22',
          },
        });
      }),
    );

    await postChatMessage({
      viewerId: 'viewer-22',
      slotId: 'tab-5',
      workspace: 'D:/workspaces/My-Code-X',
      threadId: 'thread-22',
      text: 'continue',
      runtimeSettings: {
        model: 'gpt-5.1-codex',
        reasoningEffort: 'medium',
        approvalPolicy: 'never',
        sandboxMode: 'danger-full-access',
        collaborationModeKind: 'default',
        modelContextWindow: 272000,
        modelAutoCompactTokenLimit: 240000,
      },
    });

    expect(requestBody).toEqual({
      viewerId: 'viewer-22',
      slotId: 'tab-5',
      workspace: 'D:/workspaces/My-Code-X',
      threadId: 'thread-22',
      text: 'continue',
      runtimeSettings: {
        model: 'gpt-5.1-codex',
        reasoningEffort: 'medium',
        approvalPolicy: 'never',
        sandboxMode: 'danger-full-access',
        collaborationModeKind: 'default',
        modelContextWindow: 272000,
        modelAutoCompactTokenLimit: 240000,
      },
    });
  });

  it('keeps collaborationModeKind inside runtimeSettings when the user selected a collaboration mode', async () => {
    let requestBody: Record<string, unknown> | null = null;

    server.use(
      http.post('/api/v2/chat/message', async ({ request }) => {
        requestBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          threadId: 'thread-22',
          latestTurn: {
        id: 'turn-11',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
          stream: {
            url: '/api/v2/chat/events?slotId=tab-5&threadId=thread-22',
          },
        });
      }),
    );

    await postChatMessage({
      viewerId: 'viewer-22',
      slotId: 'tab-5',
      workspace: 'D:/workspaces/My-Code-X',
      threadId: 'thread-22',
      text: 'plan first',
      runtimeSettings: {
        model: 'gpt-5.1-codex',
        reasoningEffort: 'medium',
        approvalPolicy: 'never',
        sandboxMode: 'danger-full-access',
        collaborationModeKind: 'plan',
      },
    });

    expect(requestBody).toEqual({
      viewerId: 'viewer-22',
      slotId: 'tab-5',
      workspace: 'D:/workspaces/My-Code-X',
      threadId: 'thread-22',
      text: 'plan first',
      runtimeSettings: {
        model: 'gpt-5.1-codex',
        reasoningEffort: 'medium',
        approvalPolicy: 'never',
        sandboxMode: 'danger-full-access',
        collaborationModeKind: 'plan',
      },
    });
  });

  it('returns the raw backend text for send failures', async () => {
    server.use(
      http.post('/api/v2/chat/message', () =>
        new HttpResponse('thread mismatch for tab runtime', {
          status: 502,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        }),
      ),
    );

    await expect(
      postChatMessage({
        viewerId: 'viewer-22',
        slotId: 'tab-5',
        workspace: 'D:/workspaces/My-Code-X',
        threadId: 'thread-22',
        text: 'continue',
      }),
    ).rejects.toThrowError('thread mismatch for tab runtime');
  });

  it('rejects accepted send payloads that omit latestTurn?.status', async () => {
    server.use(
      http.post('/api/v2/chat/message', () =>
        HttpResponse.json({
          threadId: 'thread-22',
          latestTurn: {
            turnId: 'turn-9',
          },
          stream: {
            url: '/api/v2/chat/events?slotId=tab-5&threadId=thread-22',
          },
        }),
      ),
    );

    await expect(
      postChatMessage({
        viewerId: 'viewer-22',
        slotId: 'tab-5',
        workspace: 'D:/workspaces/My-Code-X',
        threadId: 'thread-22',
        text: 'continue',
      }),
    ).rejects.toThrowError(
      'chat message accepted payload.latestTurn?.status must be one of idle, running, interrupting, completed, interrupted, or failed.',
    );
  });
});

describe('postChatInterrupt', () => {
  it('posts the current tab and thread and returns the interrupt ack payload', async () => {
    let requestBody: Record<string, unknown> | null = null;

    server.use(
      http.post('/api/v2/chat/interrupt', async ({ request }) => {
        requestBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          ok: true,
          threadId: 'thread-22',
          latestTurn: {
        id: 'turn-10',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
        });
      }),
    );

    const payload = await postChatInterrupt({
      slotId: 'tab-5',
      threadId: 'thread-22',
    });

    expect(requestBody).toEqual({
      slotId: 'tab-5',
      threadId: 'thread-22',
    });
    expect(payload).toEqual({
      ok: true,
      threadId: 'thread-22',
      latestTurn: {
        id: 'turn-10',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
    });
  });

  it('returns the raw backend text for interrupt failures', async () => {
    server.use(
      http.post('/api/v2/chat/interrupt', () =>
        new HttpResponse('turn not found', {
          status: 409,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        }),
      ),
    );

    await expect(
      postChatInterrupt({
        slotId: 'tab-5',
        threadId: 'thread-22',
      }),
    ).rejects.toThrowError('turn not found');
  });

  it('rejects interrupt payloads that omit latestTurn?.status', async () => {
    server.use(
      http.post('/api/v2/chat/interrupt', () =>
        HttpResponse.json({
          ok: true,
          threadId: 'thread-22',
          latestTurn: {
            turnId: 'turn-10',
          },
        }),
      ),
    );

    await expect(
      postChatInterrupt({
        slotId: 'tab-5',
        threadId: 'thread-22',
      }),
    ).rejects.toThrowError(
      'chat interrupt accepted payload.latestTurn?.status must be one of idle, running, interrupting, completed, interrupted, or failed.',
    );
  });
});

describe('postServerRequestResponse', () => {
  it('posts server-request responses and returns the ack payload', async () => {
    let requestBody: Record<string, unknown> | null = null;

    server.use(
      http.post('/api/v2/server-requests/respond', async ({ request }) => {
        requestBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          ok: true,
          requestId: 'req-1',
        });
      }),
    );

    const payload = await postServerRequestResponse({
      slotId: 'tab-5',
      threadId: 'thread-22',
      requestId: 'req-1',
      response: {
        decision: 'accept',
      },
    });

    expect(requestBody).toEqual({
      slotId: 'tab-5',
      threadId: 'thread-22',
      requestId: 'req-1',
      response: {
        decision: 'accept',
      },
    });
    expect(payload).toEqual({
      ok: true,
      requestId: 'req-1',
    });
  });

  it('returns the raw backend text when a request response fails', async () => {
    server.use(
      http.post('/api/v2/server-requests/respond', () =>
        new HttpResponse('request not found', {
          status: 409,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        }),
      ),
    );

    await expect(
      postServerRequestResponse({
        slotId: 'tab-5',
        threadId: 'thread-22',
        requestId: 'req-1',
        response: {
          decision: 'accept',
        },
      }),
    ).rejects.toThrowError('request not found');
  });
});

describe('postReviewStart', () => {
  it('posts review target and delivery details', async () => {
    let requestBody: Record<string, unknown> | null = null;

    server.use(
      http.post('/api/v2/review/start', async ({ request }) => {
        requestBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ok: true, reviewThreadId: 'thread-review-1' });
      }),
    );

    const payload = await postReviewStart({
      slotId: 'tab-5',
      threadId: 'thread-22',
      workspace: 'D:/workspaces/My-Code-X',
      delivery: 'detached',
      target: {
        type: 'baseBranch',
        branch: 'main',
      },
    });

    expect(requestBody).toEqual({
      slotId: 'tab-5',
      threadId: 'thread-22',
      workspace: 'D:/workspaces/My-Code-X',
      delivery: 'detached',
      target: {
        type: 'baseBranch',
        branch: 'main',
      },
    });
    expect(payload).toEqual({ ok: true, reviewThreadId: 'thread-review-1' });
  });
});

describe('requestAppRestart', () => {
  it('posts a restart request without clearing thread context client-side', async () => {
    let requestBody: Record<string, unknown> | null = null;

    server.use(
      http.post('/api/v2/app/restart', async ({ request }) => {
        requestBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ok: true, restarting: true });
      }),
    );

    const payload = await requestAppRestart({
      viewerId: 'viewer-22',
      slotId: 'tab-5',
      workspace: 'D:/workspaces/My-Code-X',
      threadId: 'thread-22',
    });

    expect(requestBody).toEqual({
      viewerId: 'viewer-22',
      slotId: 'tab-5',
      workspace: 'D:/workspaces/My-Code-X',
      threadId: 'thread-22',
    });
    expect(payload).toEqual({ ok: true, restarting: true });
  });
});

describe('postWorkspaceFileSave', () => {
  it('posts workspace-relative file updates and returns the save result', async () => {
    let requestBody: Record<string, unknown> | null = null;

    server.use(
      http.post('/api/v2/workspace/file', async ({ request }) => {
        requestBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          ok: true,
          path: 'docs/guide.md',
          size: 14,
          updatedAt: '2026-04-09T12:00:00.000Z',
        });
      }),
    );

    const payload = await postWorkspaceFileSave({
      workspace: 'D:/workspaces/My-Code-X',
      path: 'docs/guide.md',
      content: '# updated\n',
    });

    expect(requestBody).toEqual({
      workspace: 'D:/workspaces/My-Code-X',
      path: 'docs/guide.md',
      content: '# updated\n',
    });
    expect(payload).toEqual({
      ok: true,
      path: 'docs/guide.md',
      size: 14,
      updatedAt: '2026-04-09T12:00:00.000Z',
    });
  });
});

describe('waitForAppReady', () => {
  it('retries /api/health until a new server instance becomes reachable', async () => {
    let healthChecks = 0;
    server.use(
      http.get('/api/health', () => {
        healthChecks += 1;

        if (healthChecks === 1) {
          return new HttpResponse('bad gateway', { status: 502 });
        }

        if (healthChecks === 2) {
          return HttpResponse.json({ ok: true, serverInstanceId: 'server-old' });
        }

        return HttpResponse.json({ ok: true, serverInstanceId: 'server-new' });
      }),
    );

    const readyPromise = waitForAppReady({
      intervalMs: 100,
      timeoutMs: 1_000,
      previousServerInstanceId: 'server-old',
    });

    await expect(readyPromise).resolves.toBeUndefined();
    expect(healthChecks).toBe(3);
  });
});
