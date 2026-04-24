import { describe, expect, it } from 'vitest';

import {
  HttpResponse,
  MockEventSource,
  createUserMessage,
  http,
  registerChatRuntimeTestEnvironment,
  renderApp as render,
  screen,
  sessionGateServer as server,
  waitFor,
} from './test/chatRuntimeTestHarness';

registerChatRuntimeTestEnvironment();

describe('ChatRuntime large transcript items', () => {
  it('keeps live command execution rows title-only in the main transcript', async () => {
    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          server: { ok: true, serverInstanceId: 'gate-test', authRequired: false },
          viewer: { viewerId: url.searchParams.get('viewerId'), slotId: url.searchParams.get('slotId') },
          session: {
            workspace: 'D:/workspace/example-app',
            threadId: 'thread-large-live',
            latestTurn: {
        id: 'turn-large-live',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
            lastUpdatedAt: '2026-04-03T12:34:56.000Z',
          },
          conversation: {
            messages: [createUserMessage('user:turn-large-live', 'run checks', 'thread-large-live', 'turn-large-live')],
          },
          stream: {
            url: '/api/v2/chat/events?slotId=tab-large-live&threadId=thread-large-live',
          },
          preferences: {},
          options: {},
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-large-live');
    window.history.replaceState({}, '', `/?slot=${'tab-large-live'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-large-live');

    render();

    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    MockEventSource.instances[0]?.emit('timeline_item_updated', {
      threadId: 'thread-large-live',
      turnId: 'turn-large-live',
      item: {
        id: 'cmd-1',
        kind: 'special',
        itemType: 'commandExecution',
        text: '',
        state: 'streaming',
        threadId: 'thread-large-live',
        turnId: 'turn-large-live',
        status: 'inProgress',
        raw: {
          type: 'commandExecution',
          id: 'cmd-1',
          detailRevision: 'rev-cmd-live',
          detailAvailable: true,
        },
      },
    });

    await waitFor(() => expect(screen.getByText('Command execution')).toBeInTheDocument());
    expect(screen.queryByText('PASS 41 tests')).toBeNull();
    expect(screen.queryByText('npm test')).toBeNull();
  });

  it('keeps live file change rows title-only in the main transcript', async () => {
    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          server: { ok: true, serverInstanceId: 'gate-test', authRequired: false },
          viewer: { viewerId: url.searchParams.get('viewerId'), slotId: url.searchParams.get('slotId') },
          session: {
            workspace: 'D:/workspace/example-app',
            threadId: 'thread-large-file-live',
            latestTurn: {
        id: 'turn-large-file-live',
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
              createUserMessage(
                'user:turn-large-file-live',
                'show the diff',
                'thread-large-file-live',
                'turn-large-file-live',
              ),
            ],
          },
          stream: {
            url: '/api/v2/chat/events?slotId=tab-large-file-live&threadId=thread-large-file-live',
          },
          preferences: {},
          options: {},
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-large-file-live');
    window.history.replaceState({}, '', `/?slot=${'tab-large-file-live'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-large-file-live');

    render();

    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    MockEventSource.instances[0]?.emit('timeline_item_updated', {
      threadId: 'thread-large-file-live',
      turnId: 'turn-large-file-live',
      item: {
        id: 'file-1',
        kind: 'special',
        itemType: 'fileChange',
        text: '',
        state: 'streaming',
        threadId: 'thread-large-file-live',
        turnId: 'turn-large-file-live',
        status: 'inProgress',
        raw: {
          type: 'fileChange',
          id: 'file-1',
          detailRevision: 'rev-file-live',
          detailAvailable: true,
        },
      },
    });

    await waitFor(() => expect(screen.getByText('File change')).toBeInTheDocument());
    expect(screen.queryByText('src/app.tsx')).toBeNull();
    expect(screen.queryByText('@@ -1,1 +1,1 @@')).toBeNull();
  });
});
