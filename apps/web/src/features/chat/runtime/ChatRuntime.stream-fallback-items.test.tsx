import { describe, expect, it } from 'vitest';

import {
  HttpResponse,
  MockEventSource,
  createUserMessage,
  http,
  registerChatRuntimeTestLifecycle,
  renderApp as render,
  screen,
  sessionGateServer as server,
  waitFor,
} from './test/chatRuntimeTestHarness';

registerChatRuntimeTestLifecycle();

describe('ChatRuntime transcript fallback items', () => {
  it('keeps unknown live timeline items visible through fallback rows instead of dropping them', async () => {
    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          server: { ok: true, serverInstanceId: 'gate-test', authRequired: false },
          viewer: { viewerId: url.searchParams.get('viewerId'), slotId: url.searchParams.get('slotId') },
          session: {
            workspace: 'D:/workspace/example-app',
            threadId: 'thread-fallback-live',
            turnExecution: {
              activeTurnId: 'turn-fallback-live',
              turnLifecycle: 'running',
            },
            lastUpdatedAt: '2026-04-03T12:34:56.000Z',
          },
          conversation: {
            messages: [
              createUserMessage(
                'user:turn-fallback-live',
                'show the hidden item',
                'thread-fallback-live',
                'turn-fallback-live',
              ),
            ],
          },
          stream: {
            url: '/api/v2/chat/events?slotId=tab-fallback-live&threadId=thread-fallback-live',
          },
          preferences: {},
          options: {},
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-fallback-live');
    window.history.replaceState({}, '', `/?slot=${'tab-fallback-live'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-fallback-live');

    render();

    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    MockEventSource.instances[0]?.emit('timeline_item_updated', {
      threadId: 'thread-fallback-live',
      turnId: 'turn-fallback-live',
      item: {
        id: 'fallback-unknown-1',
        kind: 'fallback',
        itemType: 'totallyUnknownThing',
        text: '[totallyUnknownThing]',
        state: 'complete',
        threadId: 'thread-fallback-live',
        turnId: 'turn-fallback-live',
        raw: {
          type: 'totallyUnknownThing',
          id: 'fallback-unknown-1',
        },
      },
    });

    await waitFor(() => expect(screen.getByText('[totallyUnknownThing]')).toBeInTheDocument());
  });
});
