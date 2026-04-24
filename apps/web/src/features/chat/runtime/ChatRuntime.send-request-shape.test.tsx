import { describe, expect, it } from 'vitest';

import {
  HttpResponse,
  MockEventSource,
  createSessionResponse,
  fireEvent,
  http,
  registerChatRuntimeTestEnvironment,
  renderApp as render,
  screen,
  sessionGateServer as server,
  setTextboxValue,
  userEvent,
  waitFor,
} from './test/chatRuntimeTestHarness';

registerChatRuntimeTestEnvironment();

describe('ChatRuntime send request shape', () => {
  it('submits trimmed text on first send, persists the returned thread id, and opens the stream', async () => {
    const sendBodies: Array<Record<string, unknown>> = [];

    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        return createSessionResponse({
          viewerId: url.searchParams.get('viewerId'),
          slotId: url.searchParams.get('slotId'),
          threadId: '',
          messages: [],
        });
      }),
      http.post('/api/v2/chat/message', async ({ request }) => {
        sendBodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({
          threadId: 'thread-sent',
          latestTurn: {
        id: 'turn-sent',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
          stream: {
            url: '/api/v2/chat/events?slotId=tab-send&threadId=thread-sent',
          },
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-send');
    window.history.replaceState({}, '', `/?slot=${'tab-send'}`);

    const user = userEvent.setup();
    render();

    await waitFor(() => expect(screen.getByText('Session synced')).toBeInTheDocument());

    setTextboxValue('chat input', '  Explain this bug  ');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() =>
      expect(sendBodies).toEqual([
        expect.objectContaining({
          viewerId: 'viewer-send',
          slotId: expect.stringMatching(/^(slot|tab)-/),
          workspace: 'D:/workspace/example-app',
          content: [{ type: 'text', text: 'Explain this bug' }],
          runtimeSettings: {
            model: 'gpt-5.1-codex',
            reasoningEffort: 'medium',
            approvalPolicy: 'never',
            sandboxMode: 'danger-full-access',
            collaborationModeKind: 'default',
          },
        }),
      ]),
    );
    await waitFor(() => expect(window.localStorage.getItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`)).toBe('thread-sent'));
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
    expect(MockEventSource.instances[0]?.url).toBe('/api/v2/chat/events?slotId=tab-send&threadId=thread-sent');
    expect(screen.getByRole('button', { name: 'Stop' })).toBeEnabled();
  });

  it('does not submit whitespace-only input', async () => {
    let sendCount = 0;

    server.use(
      http.post('/api/v2/chat/message', () => {
        sendCount += 1;
        return HttpResponse.json({
          threadId: 'thread-should-not-send',
          latestTurn: {
        id: 'turn-should-not-send',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
          stream: {
            url: '/api/v2/chat/events?slotId=tab-ready&threadId=thread-should-not-send',
          },
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-whitespace');
    window.history.replaceState({}, '', `/?slot=${'tab-whitespace'}`);

    const user = userEvent.setup();
    render();

    await waitFor(() => expect(screen.getByText('Session synced')).toBeInTheDocument());

    setTextboxValue('chat input', '   ');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(sendCount).toBe(0));
    expect(MockEventSource.instances).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();
  });

  it('prevents rapid duplicate submits from creating more than one turn', async () => {
    const sendBodies: Array<Record<string, unknown>> = [];

    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        return createSessionResponse({
          viewerId: url.searchParams.get('viewerId'),
          slotId: url.searchParams.get('slotId'),
          threadId: 'thread-existing',
          messages: [],
        });
      }),
      http.post('/api/v2/chat/message', async ({ request }) => {
        sendBodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({
          threadId: 'thread-existing',
          latestTurn: {
        id: 'turn-only',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
          stream: {
            url: '/api/v2/chat/events?slotId=tab-rapid&threadId=thread-existing',
          },
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-rapid');
    window.history.replaceState({}, '', `/?slot=${'tab-rapid'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-existing');

    render();

    await waitFor(() => expect(screen.getByText('Session synced')).toBeInTheDocument());

    setTextboxValue('chat input', 'Run tests');
    const form = screen.getByRole('form', { name: 'chat composer' });
    fireEvent.submit(form);
    fireEvent.submit(form);

    await waitFor(() => expect(sendBodies).toHaveLength(1));
    expect(sendBodies[0]).toEqual({
      viewerId: 'viewer-rapid',
      slotId: expect.stringMatching(/^(slot|tab)-/),
      workspace: 'D:/workspace/example-app',
      threadId: 'thread-existing',
      content: [{ type: 'text', text: 'Run tests' }],
      runtimeSettings: {
        model: 'gpt-5.1-codex',
        reasoningEffort: 'medium',
        approvalPolicy: 'never',
        sandboxMode: 'danger-full-access',
        collaborationModeKind: 'default',
      },
    });
  });

  it('reuses the existing thread id for a same-tab follow-up send', async () => {
    const sendBodies: Array<Record<string, unknown>> = [];

    server.use(
      http.post('/api/v2/chat/message', async ({ request }) => {
        sendBodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({
          threadId: 'thread-ready',
          latestTurn: {
        id: 'turn-follow-up',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
          stream: {
            url: '/api/v2/chat/events?slotId=tab-follow-up&threadId=thread-ready',
          },
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-follow-up');
    window.history.replaceState({}, '', `/?slot=${'tab-follow-up'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-ready');

    const user = userEvent.setup();
    render();

    await waitFor(() => expect(screen.getByText('Session synced')).toBeInTheDocument());

    setTextboxValue('chat input', 'second message');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(sendBodies).toHaveLength(1));
    expect(sendBodies[0]).toEqual({
      viewerId: 'viewer-follow-up',
      slotId: expect.stringMatching(/^(slot|tab)-/),
      workspace: 'D:/workspace/example-app',
      threadId: 'thread-ready',
      content: [{ type: 'text', text: 'second message' }],
      runtimeSettings: {
        model: 'gpt-5.1-codex',
        reasoningEffort: 'medium',
        approvalPolicy: 'never',
        sandboxMode: 'danger-full-access',
        collaborationModeKind: 'default',
      },
    });
  });
});
