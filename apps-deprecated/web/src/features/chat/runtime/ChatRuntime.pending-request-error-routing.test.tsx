import { within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  HttpResponse,
  MockEventSource,
  createAssistantMessage,
  http,
  registerChatRuntimeTestLifecycle,
  renderApp as render,
  screen,
  sessionGateServer as server,
  setTextboxValue,
  userEvent,
  waitFor,
} from './test/chatRuntimeTestHarness';

registerChatRuntimeTestLifecycle();

describe('ChatRuntime pending request error routing', () => {
  it('surfaces pending-request submission failures outside the transcript while keeping the request card retryable', async () => {
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
      http.post('/api/v2/server-requests/respond', () =>
        new HttpResponse('request not found', {
          status: 409,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
          },
        })),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-auth-refresh-routing');
    window.history.replaceState({}, '', `/?slot=${'tab-auth-refresh-routing'}`);
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

    const user = userEvent.setup();
    setTextboxValue('Access token', 'token-123');
    setTextboxValue('Account id', 'acct-9');
    await user.click(screen.getByRole('button', { name: 'Submit tokens' }));

    await waitFor(() =>
      expect(screen.getByRole('alert', { name: 'Chat page feedback' })).toHaveTextContent('request not found'),
    );

    const transcriptSection = screen.getByLabelText('chat transcript section');
    const transcriptLog = screen.getByRole('log', { name: 'chat transcript' });
    const globalAlert = screen.getByRole('alert', { name: 'Chat page feedback' });

    expect(within(transcriptLog).queryByText('request not found')).toBeNull();
    expect(transcriptLog).not.toContainElement(globalAlert);
    expect(transcriptSection).not.toContainElement(globalAlert);
    expect(within(transcriptSection).queryByRole('alert')).toBeNull();
    expect(screen.getByText('Refresh ChatGPT authentication')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit tokens' })).toBeEnabled();
  });

  it('routes turn-bound pending-request failures to the shared chatpage error without inserting them into the transcript log', async () => {
    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          server: { ok: true, serverInstanceId: 'gate-test', authRequired: false },
          viewer: { viewerId: url.searchParams.get('viewerId'), slotId: url.searchParams.get('slotId') },
          session: {
            workspace: 'D:/workspace/example-app',
            threadId: 'thread-user-input',
            turnExecution: {
              activeTurnId: 'turn-user-input',
              turnLifecycle: 'running',
            },
            lastUpdatedAt: '2026-04-03T12:34:56.000Z',
          },
          conversation: {
            messages: [
              createAssistantMessage(
                'assistant:turn-user-input',
                'Which environment should I use?',
                'thread-user-input',
                'turn-user-input',
              ),
            ],
          },
          stream: {
            url: '/api/v2/chat/events?slotId=tab-user-input&threadId=thread-user-input',
          },
          preferences: {},
          options: {},
          pendingRequests: [],
        });
      }),
      http.post('/api/v2/server-requests/respond', () =>
        new HttpResponse('request not found', {
          status: 409,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
          },
        })),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-user-input-routing');
    window.history.replaceState({}, '', `/?slot=${'tab-user-input-routing'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-user-input');

    render();

    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    MockEventSource.instances[0]?.emit('pending_request_updated', {
      threadId: 'thread-user-input',
      request: {
        id: 'req-input',
        method: 'item/tool/requestUserInput',
        kind: 'user_input',
        threadId: 'thread-user-input',
        turnId: 'turn-user-input',
        itemId: 'ask-missing',
        title: 'Answer 1 question',
        prompt: '',
        questions: [
          {
            id: 'environment',
            header: 'Env',
            question: 'Which environment should I use?',
            options: [{ label: 'Staging', description: 'Use staging' }],
          },
        ],
        submitState: 'idle',
        raw: {},
      },
    });

    await waitFor(() => expect(screen.getByText('Answer 1 question')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: 'Staging' }));
    await user.click(screen.getByRole('button', { name: 'Submit input' }));

    await waitFor(() =>
      expect(screen.getByRole('alert', { name: 'Chat page feedback' })).toHaveTextContent('request not found'),
    );

    const transcriptSection = screen.getByLabelText('chat transcript section');
    const transcriptLog = screen.getByRole('log', { name: 'chat transcript' });
    const globalAlert = screen.getByRole('alert', { name: 'Chat page feedback' });

    expect(within(transcriptLog).queryByText('request not found')).toBeNull();
    expect(transcriptLog).not.toContainElement(globalAlert);
    expect(transcriptSection).not.toContainElement(globalAlert);
    expect(within(transcriptSection).queryByRole('alert')).toBeNull();
    expect(screen.getByText('Answer 1 question')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit input' })).toBeEnabled();
  });
});
