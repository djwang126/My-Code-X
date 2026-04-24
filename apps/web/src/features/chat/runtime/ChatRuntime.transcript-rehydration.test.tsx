import { describe, expect, it } from 'vitest';

import {
  HttpResponse,
  MockEventSource,
  createAssistantMessage,
  createUserMessage,
  http,
  registerChatRuntimeTestEnvironment,
  renderApp as render,
  screen,
  sessionGateServer as server,
  setDocumentVisibility,
  waitFor,
} from './test/chatRuntimeTestHarness';

registerChatRuntimeTestEnvironment();

describe('ChatRuntime transcript rehydration', () => {
  it('keeps the latest resumed user message in chronological order when bootstrap payload ids repeat', async () => {
    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);

        return HttpResponse.json({
          server: { ok: true, serverInstanceId: 'gate-test', authRequired: false },
          viewer: {
            viewerId: url.searchParams.get('viewerId'),
            slotId: url.searchParams.get('slotId'),
          },
          session: {
            workspace: 'D:/workspace/example-app',
            threadId: 'thread-duplicate-user-order',
            latestTurn: {
        id: 'turn-latest',
        status: 'completed',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
            lastUpdatedAt: '2026-04-03T12:40:56.000Z',
          },
          conversation: {
            messages: [
              createUserMessage('dup-user', 'older question', 'thread-duplicate-user-order', 'turn-earlier'),
              createAssistantMessage('assistant-earlier', 'older answer', 'thread-duplicate-user-order', 'turn-earlier'),
              createUserMessage('dup-user', 'latest question', 'thread-duplicate-user-order', 'turn-latest'),
              createAssistantMessage('assistant-latest', 'latest answer', 'thread-duplicate-user-order', 'turn-latest'),
            ],
          },
          stream: {
            url: '/api/v2/chat/events?slotId=tab-duplicate-user-order&threadId=thread-duplicate-user-order',
          },
          preferences: {},
          options: {},
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-duplicate-user-order');
    window.history.replaceState({}, '', `/?slot=${'tab-duplicate-user-order'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-duplicate-user-order');

    render();

    await waitFor(() => expect(screen.getByText('latest answer')).toBeInTheDocument());

    const transcriptText = screen.getByRole('log', { name: 'chat transcript' }).textContent ?? '';

    expect(transcriptText).toContain('older question');
    expect(transcriptText).toContain('older answer');
    expect(transcriptText).toContain('latest question');
    expect(transcriptText).toContain('latest answer');
    expect(transcriptText.indexOf('older question')).toBeLessThan(transcriptText.indexOf('older answer'));
    expect(transcriptText.indexOf('older answer')).toBeLessThan(transcriptText.indexOf('latest question'));
    expect(transcriptText.indexOf('latest question')).toBeLessThan(transcriptText.indexOf('latest answer'));
  });

  it('re-bootstraps on visibility return and replaces stale in-progress transcript with the latest backend snapshot', async () => {
    let requestCount = 0;

    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        requestCount += 1;

        if (requestCount === 1) {
          return HttpResponse.json({
            server: { ok: true, serverInstanceId: 'gate-test', authRequired: false },
            viewer: {
              viewerId: url.searchParams.get('viewerId'),
              slotId: url.searchParams.get('slotId'),
            },
            session: {
              workspace: 'D:/workspace/example-app',
              threadId: 'thread-returning',
              latestTurn: {
        id: 'turn-running',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
              lastUpdatedAt: '2026-04-03T12:34:56.000Z',
            },
            conversation: {
              messages: [
                createUserMessage('user:turn-running', 'status?', 'thread-returning', 'turn-running'),
                createAssistantMessage(
                  'assistant:turn-running',
                  'still thinking',
                  'thread-returning',
                  'turn-running',
                  'streaming',
                ),
              ],
            },
            stream: {
              url: '/api/v2/chat/events?slotId=tab-returning&threadId=thread-returning',
            },
            preferences: {},
            options: {},
          });
        }

        return HttpResponse.json({
          server: { ok: true, serverInstanceId: 'gate-test', authRequired: false },
          viewer: {
            viewerId: url.searchParams.get('viewerId'),
            slotId: url.searchParams.get('slotId'),
          },
          session: {
            workspace: 'D:/workspace/example-app',
            threadId: 'thread-returning',
            latestTurn: {
        id: 'turn-running',
        status: 'completed',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
            lastUpdatedAt: '2026-04-03T12:40:56.000Z',
          },
          conversation: {
            messages: [
              createUserMessage('user:turn-running', 'status?', 'thread-returning', 'turn-running'),
              createAssistantMessage('assistant:turn-running', 'done now', 'thread-returning', 'turn-running'),
            ],
          },
          stream: {
            url: '/api/v2/chat/events?slotId=tab-returning&threadId=thread-returning',
          },
          preferences: {},
          options: {},
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-returning');
    window.history.replaceState({}, '', `/?slot=${'tab-returning'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-returning');

    render();

    await waitFor(() => expect(screen.getByText('still thinking')).toBeInTheDocument());
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    setDocumentVisibility('hidden');
    await waitFor(() => expect(MockEventSource.instances[0]?.closed).toBe(true));

    setDocumentVisibility('visible');

    await waitFor(() => expect(screen.getByText('done now')).toBeInTheDocument());
    expect(screen.queryByText('still thinking')).not.toBeInTheDocument();
    expect(requestCount).toBe(2);
  });

  it('hydrates before reconnecting on visibility return, so a completed turn does not open a replacement stream', async () => {
    let requestCount = 0;

    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        requestCount += 1;

        return HttpResponse.json({
          server: { ok: true, serverInstanceId: 'gate-test', authRequired: false },
          viewer: { viewerId: url.searchParams.get('viewerId'), slotId: url.searchParams.get('slotId') },
          session: {
            workspace: 'D:/workspace/example-app',
            threadId: 'thread-completed-on-return',
            latestTurn: {
              turnId: 'turn-completed-on-return',
              status: requestCount === 1 ? 'inProgress' : 'completed',
            },
            lastUpdatedAt: '2026-04-03T12:34:56.000Z',
          },
          conversation: {
            messages: [
              createUserMessage(
                'user:turn-completed-on-return',
                'status?',
                'thread-completed-on-return',
                'turn-completed-on-return',
              ),
              createAssistantMessage(
                'assistant:turn-completed-on-return',
                requestCount === 1 ? 'still thinking' : 'done now',
                'thread-completed-on-return',
                'turn-completed-on-return',
                requestCount === 1 ? 'streaming' : 'complete',
              ),
            ],
          },
          stream: {
            url: '/api/v2/chat/events?slotId=tab-completed-on-return&threadId=thread-completed-on-return',
          },
          preferences: {},
          options: {},
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-completed-on-return');
    window.history.replaceState({}, '', `/?slot=${'tab-completed-on-return'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-completed-on-return');

    render();

    await waitFor(() => expect(screen.getByText('still thinking')).toBeInTheDocument());
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    const initialStream = MockEventSource.instances[0];

    setDocumentVisibility('hidden');
    await waitFor(() => expect(initialStream?.closed).toBe(true));

    setDocumentVisibility('visible');

    await waitFor(() => expect(screen.getByText('done now')).toBeInTheDocument());
    expect(requestCount).toBe(2);
    expect(MockEventSource.instances).toHaveLength(1);
  });
});
