import { describe, expect, it } from 'vitest';

import {
  HttpResponse,
  MockEventSource,
  http,
  registerChatRuntimeTestEnvironment,
  renderApp as render,
  screen,
  sessionGateServer as server,
  userEvent,
  waitFor,
} from './test/chatRuntimeTestHarness';

registerChatRuntimeTestEnvironment();

describe('ChatRuntime stop turn', () => {
  it('switches the send button to Stop while a turn is running and interrupts the active turn when clicked', async () => {
    const interruptBodies: Array<Record<string, unknown>> = [];

    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          server: { ok: true, serverInstanceId: 'gate-test', authRequired: false },
          viewer: { viewerId: url.searchParams.get('viewerId'), slotId: url.searchParams.get('slotId') },
          session: {
            workspace: 'D:/workspace/example-app',
            threadId: 'thread-running',
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
            messages: [],
          },
          stream: {
            url: '/api/v2/chat/events?slotId=tab-stop&threadId=thread-running',
          },
          preferences: {},
          options: {},
        });
      }),
      http.post('/api/v2/chat/interrupt', async ({ request }) => {
        interruptBodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({
          ok: true,
          threadId: 'thread-running',
          latestTurn: {
        id: 'turn-running',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-stop');
    window.history.replaceState({}, '', `/?slot=${'tab-stop'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-running');

    const user = userEvent.setup();
    render();

    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    const stopButton = screen.getByRole('button', { name: 'Stop' });
    expect(stopButton).toBeEnabled();

    await user.click(stopButton);

    await waitFor(() =>
      expect(interruptBodies).toEqual([
        expect.objectContaining({
          slotId: expect.stringMatching(/^(slot|tab)-/),
          threadId: 'thread-running',
        }),
      ]),
    );

    expect(screen.getByRole('button', { name: 'Stopping…' })).toBeDisabled();
  });
});
