import { describe, expect, it } from 'vitest';

import {
  HttpResponse,
  MockEventSource,
  createUserMessage,
  http,
  registerSessionGateTestLifecycle,
  renderApp as render,
  screen,
  sessionGateServer as server,
  waitFor,
} from './test/sessionGateTestHarness';

registerSessionGateTestLifecycle();

describe('SessionGate transcript timeline deltas', () => {
  it('applies consecutive live timeline_item_delta events in place for an existing special row', async () => {
    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          server: { ok: true, serverInstanceId: 'gate-test', authRequired: false },
          viewer: { viewerId: url.searchParams.get('viewerId'), slotId: url.searchParams.get('slotId') },
          session: {
            workspace: 'D:/workspace/example-app',
            threadId: 'thread-delta-live',
            turnExecution: {
              activeTurnId: 'turn-delta-live',
              turnLifecycle: 'running',
            },
            lastUpdatedAt: '2026-04-03T12:34:56.000Z',
          },
          conversation: {
            messages: [
              createUserMessage('user:turn-delta-live', 'run checks', 'thread-delta-live', 'turn-delta-live'),
              {
                id: 'plan-1',
                kind: 'special',
                itemType: 'plan',
                text: '',
                state: 'streaming',
                threadId: 'thread-delta-live',
                turnId: 'turn-delta-live',
                raw: {
                  type: 'plan',
                  id: 'plan-1',
                  text: '',
                },
              },
            ],
          },
          stream: {
            url: '/api/v2/chat/events?slotId=tab-delta-live&threadId=thread-delta-live',
          },
          preferences: {},
          options: {},
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-delta-live');
    window.history.replaceState({}, '', `/?slot=${'tab-delta-live'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-delta-live');

    render();

    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
    expect(screen.getAllByText('Plan')).toHaveLength(1);

    MockEventSource.instances[0]?.emit('timeline_item_delta', {
      threadId: 'thread-delta-live',
      turnId: 'turn-delta-live',
      itemId: 'plan-1',
      itemType: 'plan',
      delta: 'Inspect ',
    });
    MockEventSource.instances[0]?.emit('timeline_item_delta', {
      threadId: 'thread-delta-live',
      turnId: 'turn-delta-live',
      itemId: 'plan-1',
      itemType: 'plan',
      delta: 'reducer state',
    });

    await waitFor(() => expect(screen.getByText('Inspect reducer state')).toBeInTheDocument());
    expect(screen.getAllByText('Plan')).toHaveLength(1);
  });
});
