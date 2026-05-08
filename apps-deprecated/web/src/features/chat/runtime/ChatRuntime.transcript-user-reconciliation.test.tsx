import { within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  HttpResponse,
  MockEventSource,
  http,
  registerChatRuntimeTestLifecycle,
  renderApp as render,
  screen,
  sessionGateServer as server,
  waitFor,
} from './test/chatRuntimeTestHarness';

registerChatRuntimeTestLifecycle();

describe('ChatRuntime transcript user reconciliation', () => {
  it('applies reconciled user message content onto the existing accepted row instead of appending a duplicate row', async () => {
    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          server: { ok: true, serverInstanceId: 'gate-test', authRequired: false },
          viewer: { viewerId: url.searchParams.get('viewerId'), slotId: url.searchParams.get('slotId') },
          session: {
            workspace: 'D:/workspace/example-app',
            threadId: 'thread-user-reconcile',
            turnExecution: {
              activeTurnId: 'turn-user-reconcile',
              turnLifecycle: 'running',
            },
            lastUpdatedAt: '2026-04-03T12:34:56.000Z',
          },
          conversation: {
            messages: [
              {
                id: 'user:turn-user-reconcile',
                kind: 'message',
                itemType: 'userMessage',
                role: 'user',
                text: 'Investigate this regression',
                state: 'streaming',
                threadId: 'thread-user-reconcile',
                turnId: 'turn-user-reconcile',
                raw: {
                  type: 'userMessage',
                  id: 'user:turn-user-reconcile',
                },
              },
            ],
          },
          stream: {
            url: '/api/v2/chat/events?slotId=tab-user-reconcile&threadId=thread-user-reconcile',
          },
          preferences: {},
          options: {},
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-user-reconcile');
    window.history.replaceState({}, '', `/?slot=${'tab-user-reconcile'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-user-reconcile');

    render();

    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    const transcriptLog = screen.getByRole('log', { name: 'chat transcript' });
    await waitFor(() =>
      expect(within(transcriptLog).getAllByText('Investigate this regression')).toHaveLength(1),
    );

    MockEventSource.instances.at(-1)?.emit('timeline_item_updated', {
      threadId: 'thread-user-reconcile',
      turnId: 'turn-user-reconcile',
      item: {
        id: 'user:turn-user-reconcile',
        kind: 'message',
        itemType: 'userMessage',
        role: 'user',
        text: 'Investigate this regression',
        state: 'complete',
        threadId: 'thread-user-reconcile',
        turnId: 'turn-user-reconcile',
        content: [
          { type: 'text', text: 'Investigate this regression' },
          { type: 'skill', name: 'playwright', path: 'skill://playwright' },
        ],
        raw: {
          type: 'userMessage',
          id: 'canonical-user-1',
        },
      },
    });

    await waitFor(() =>
      expect(within(transcriptLog).getAllByText('Investigate this regression')).toHaveLength(1),
    );
    expect(within(transcriptLog).getByLabelText('skill playwright')).toBeInTheDocument();
  });
});
