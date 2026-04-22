import { describe, expect, it } from 'vitest';

import {
  HttpResponse,
  MockEventSource,
  http,
  registerSessionGateTestLifecycle,
  renderApp as render,
  screen,
  sessionGateServer as server,
  setTextboxValue,
  userEvent,
  waitFor,
} from './test/sessionGateTestHarness';

registerSessionGateTestLifecycle();

describe('SessionGate pending requests', () => {
  it('submits threadless auth-refresh responses without forcing the active thread id', async () => {
    const requestBodies: Array<Record<string, unknown>> = [];

    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          server: { ok: true, serverInstanceId: 'gate-test', authRequired: false },
          viewer: { viewerId: url.searchParams.get('viewerId'), slotId: url.searchParams.get('slotId') },
          session: {
            workspace: 'D:/workspace/example-app',
            threadId: 'thread-auth-refresh',
            turnExecution: {
              activeTurnId: 'turn-auth-refresh',
              turnLifecycle: 'running',
            },
            lastUpdatedAt: '2026-04-03T12:34:56.000Z',
          },
          conversation: {
            messages: [],
          },
          stream: {
            url: '/api/v2/chat/events?slotId=tab-auth-refresh&threadId=thread-auth-refresh',
          },
          preferences: {},
          options: {},
          pendingRequests: [],
        });
      }),
      http.post('/api/v2/server-requests/respond', async ({ request }) => {
        requestBodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({
          ok: true,
          requestId: 'req-auth',
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-auth-refresh');
    window.history.replaceState({}, '', `/?slot=${'tab-auth-refresh'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-auth-refresh');

    render();

    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    MockEventSource.instances[0]?.emit('pending_request_updated', {
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

    await waitFor(() => expect(screen.getByText('Refresh ChatGPT authentication')).toBeInTheDocument());
    expect(screen.getByText('Thread: thread-auth-refresh')).toBeInTheDocument();

    const user = userEvent.setup();
    setTextboxValue('Access token', 'token-123');
    setTextboxValue('Account id', 'acct-9');
    await user.click(screen.getByRole('button', { name: 'Submit tokens' }));

    await waitFor(() =>
      expect(requestBodies).toEqual([
        expect.objectContaining({
          slotId: expect.stringMatching(/^(slot|tab)-/),
          threadId: '',
          requestId: 'req-auth',
          response: {
            accessToken: 'token-123',
            chatgptAccountId: 'acct-9',
          },
        }),
      ]),
    );

    MockEventSource.instances[0]?.emit('pending_request_resolved', {
      threadId: '',
      requestId: 'req-auth',
      notice: {
        id: 'serverRequest/resolved:req-auth',
        level: 'info',
        title: 'Request resolved',
        text: 'Resolved request req-auth',
      },
    });

    await waitFor(() => expect(screen.queryByText('Refresh ChatGPT authentication')).not.toBeInTheDocument());
    expect(screen.getByText('Resolved request req-auth')).toBeInTheDocument();
    expect(screen.getByText('Thread: thread-auth-refresh')).toBeInTheDocument();
  });

  it('surfaces threadless request conflicts and recovers cleanly when another client resolves the request', async () => {
    let respondAttempts = 0;

    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          server: { ok: true, serverInstanceId: 'gate-test', authRequired: false },
          viewer: { viewerId: url.searchParams.get('viewerId'), slotId: url.searchParams.get('slotId') },
          session: {
            workspace: 'D:/workspace/example-app',
            threadId: 'thread-auth-refresh-conflict',
            turnExecution: {
              activeTurnId: 'turn-auth-refresh-conflict',
              turnLifecycle: 'running',
            },
            lastUpdatedAt: '2026-04-03T12:34:56.000Z',
          },
          conversation: {
            messages: [],
          },
          stream: {
            url: '/api/v2/chat/events?slotId=tab-auth-refresh-conflict&threadId=thread-auth-refresh-conflict',
          },
          preferences: {},
          options: {},
          pendingRequests: [],
        });
      }),
      http.post('/api/v2/server-requests/respond', () => {
        respondAttempts += 1;
        return new HttpResponse('request not found', {
          status: 409,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
          },
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-auth-refresh-conflict');
    window.history.replaceState({}, '', `/?slot=${'tab-auth-refresh-conflict'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-auth-refresh-conflict');

    render();

    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    MockEventSource.instances[0]?.emit('pending_request_updated', {
      threadId: '',
      request: {
        id: 'req-auth-conflict',
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

    await waitFor(() => expect(screen.getByText('Refresh ChatGPT authentication')).toBeInTheDocument());

    const user = userEvent.setup();
    setTextboxValue('Access token', 'token-123');
    setTextboxValue('Account id', 'acct-9');
    await user.click(screen.getByRole('button', { name: 'Submit tokens' }));

    await waitFor(() => expect(screen.getByText('request not found')).toBeInTheDocument());
    expect(respondAttempts).toBe(1);
    expect(screen.getByRole('button', { name: 'Submit tokens' })).toBeEnabled();
    expect(screen.getByText('Refresh ChatGPT authentication')).toBeInTheDocument();

    MockEventSource.instances[0]?.emit('pending_request_resolved', {
      threadId: '',
      requestId: 'req-auth-conflict',
      notice: {
        id: 'serverRequest/resolved:req-auth-conflict',
        level: 'info',
        title: 'Request resolved',
        text: 'Resolved request req-auth-conflict',
      },
    });

    await waitFor(() => expect(screen.queryByText('Refresh ChatGPT authentication')).not.toBeInTheDocument());
    expect(screen.getByText('Resolved request req-auth-conflict')).toBeInTheDocument();
  });

});
