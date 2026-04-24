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

describe('ChatRuntime transcript rehydration live continuation', () => {
  it('continues the same in-progress transcript with live events after visibility rehydration', async () => {
    let requestCount = 0;

    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        requestCount += 1;

        return HttpResponse.json({
          server: { ok: true, serverInstanceId: 'gate-test', authRequired: false },
          viewer: {
            viewerId: url.searchParams.get('viewerId'),
            slotId: url.searchParams.get('slotId'),
          },
          session: {
            workspace: 'D:/workspace/example-app',
            threadId: 'thread-live-return',
            latestTurn: {
        id: 'turn-live-return',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
            lastUpdatedAt: requestCount === 1 ? '2026-04-03T12:34:56.000Z' : '2026-04-03T12:35:56.000Z',
          },
          conversation: {
            messages: [
              createUserMessage('user:turn-live-return', 'status?', 'thread-live-return', 'turn-live-return'),
              createAssistantMessage(
                'assistant:turn-live-return',
                requestCount === 1 ? 'still thinking' : 'still thinking more',
                'thread-live-return',
                'turn-live-return',
                'streaming',
              ),
            ],
          },
          stream: {
            url: '/api/v2/chat/events?slotId=tab-live-return&threadId=thread-live-return',
          },
          preferences: {},
          options: {},
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-live-return');
    window.history.replaceState({}, '', `/?slot=${'tab-live-return'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-live-return');

    render();

    await waitFor(() => expect(screen.getByText('still thinking')).toBeInTheDocument());
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    setDocumentVisibility('hidden');
    await waitFor(() => expect(MockEventSource.instances[0]?.closed).toBe(true));

    setDocumentVisibility('visible');

    await waitFor(() => expect(requestCount).toBe(2));
    await waitFor(() => expect(screen.getByText('still thinking more')).toBeInTheDocument());
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(2));

    MockEventSource.instances.at(-1)?.emit('assistant_delta', {
      threadId: 'thread-live-return',
      turnId: 'turn-live-return',
      messageId: 'assistant:turn-live-return',
      delta: ' even more',
      text: 'still thinking more even more',
    });

    await waitFor(() => expect(screen.getByText('still thinking more even more')).toBeInTheDocument());
    expect(screen.queryByText('still thinking')).not.toBeInTheDocument();
    expect(screen.getAllByText('still thinking more even more')).toHaveLength(1);
  });
});
