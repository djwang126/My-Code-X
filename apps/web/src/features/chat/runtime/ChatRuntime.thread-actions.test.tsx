import { describe, expect, it } from 'vitest';

import {
  HttpResponse,
  createAssistantMessage,
  createSessionResponse,
  createUserMessage,
  http,
  registerChatRuntimeTestEnvironment,
  renderApp as render,
  screen,
  sessionGateServer as server,
  userEvent,
  waitFor,
} from './test/chatRuntimeTestHarness';

registerChatRuntimeTestEnvironment();

describe('ChatRuntime thread actions', () => {
  it('forks from a completed assistant reply and switches to the forked thread', async () => {
    const forkBodies: Array<Record<string, unknown>> = [];

    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        return createSessionResponse({
          viewerId: url.searchParams.get('viewerId'),
          slotId: url.searchParams.get('slotId'),
          threadId: url.searchParams.get('threadId') || 'thread-ready',
          messages: [
            createUserMessage('user:turn-1', 'first prompt', 'thread-ready', 'turn-1'),
            createAssistantMessage('assistant:turn-1', 'first answer', 'thread-ready', 'turn-1'),
            createUserMessage('user:turn-2', 'second prompt', 'thread-ready', 'turn-2'),
            createAssistantMessage('assistant:turn-2', 'second answer', 'thread-ready', 'turn-2'),
          ],
        });
      }),
      http.post('/api/v2/thread/fork', async ({ request }) => {
        forkBodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({
          kind: 'threadForked',
          sourceThreadId: 'thread-ready',
          threadId: 'thread-forked',
          snapshot: {
            threadId: 'thread-forked',
            latestTurn: null,
            messages: [
              createUserMessage('user:turn-1', 'first prompt', 'thread-forked', 'turn-1'),
              createAssistantMessage('assistant:turn-1', 'first answer', 'thread-forked', 'turn-1'),
            ],
            notices: [],
            pendingRequests: [],
            lastError: null,
          },
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-fork');
    window.history.replaceState({}, '', `/?slot=${'tab-fork'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-ready');

    const user = userEvent.setup();
    render();

    await waitFor(() => expect(screen.getByText('first answer')).toBeInTheDocument());

    const forkButtons = screen.getAllByRole('button', { name: 'Fork reply' });
    expect(forkButtons).toHaveLength(2);
    await user.click(forkButtons[0]);

    await waitFor(() =>
      expect(forkBodies).toEqual([
        expect.objectContaining({
          slotId: expect.stringMatching(/^(slot|tab)-/),
          threadId: 'thread-ready',
          workspace: 'D:/workspace/example-app',
          preservedTurnCount: 1,
        }),
      ]),
    );

    await waitFor(() => expect(screen.queryByText('No messages yet')).toBeNull());
  });

  it('counts preserved turns by turn boundary instead of assistant message count', async () => {
    const forkBodies: Array<Record<string, unknown>> = [];

    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        return createSessionResponse({
          viewerId: url.searchParams.get('viewerId'),
          slotId: url.searchParams.get('slotId'),
          threadId: url.searchParams.get('threadId') || 'thread-ready',
          messages: [
            createUserMessage('user:turn-1', 'first prompt', 'thread-ready', 'turn-1'),
            createAssistantMessage('assistant:turn-1:a', 'first partial answer', 'thread-ready', 'turn-1'),
            createAssistantMessage('assistant:turn-1:b', 'first final answer', 'thread-ready', 'turn-1'),
            createUserMessage('user:turn-2', 'second prompt', 'thread-ready', 'turn-2'),
            createAssistantMessage('assistant:turn-2', 'second answer', 'thread-ready', 'turn-2'),
          ],
        });
      }),
      http.post('/api/v2/thread/fork', async ({ request }) => {
        forkBodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({
          kind: 'threadForked',
          sourceThreadId: 'thread-ready',
          threadId: 'thread-forked-multi-assistant',
          snapshot: {
            threadId: 'thread-forked-multi-assistant',
            latestTurn: null,
            messages: [
              createUserMessage('user:turn-1', 'first prompt', 'thread-forked-multi-assistant', 'turn-1'),
              createAssistantMessage('assistant:turn-1:b', 'first final answer', 'thread-forked-multi-assistant', 'turn-1'),
            ],
            notices: [],
            pendingRequests: [],
            lastError: null,
          },
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-fork-multi');
    window.history.replaceState({}, '', `/?slot=${'tab-fork-multi'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-ready');

    const user = userEvent.setup();
    render();

    await waitFor(() => expect(screen.getByText('first final answer')).toBeInTheDocument());

    const forkButtons = screen.getAllByRole('button', { name: 'Fork reply' });
    expect(forkButtons).toHaveLength(2);
    await user.click(forkButtons[0]);

    await waitFor(() =>
      expect(forkBodies).toEqual([
        expect.objectContaining({
          slotId: expect.stringMatching(/^(slot|tab)-/),
          threadId: 'thread-ready',
          workspace: 'D:/workspace/example-app',
          preservedTurnCount: 1,
        }),
      ]),
    );
  });

  it('rolls back the active thread by one turn and refreshes the current thread like fork does', async () => {
    const rollbackBodies: Array<Record<string, unknown>> = [];
    const sessionRequests: string[] = [];

    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        sessionRequests.push(url.searchParams.get('threadId') || '');

        const threadId = url.searchParams.get('threadId') || 'thread-ready';
        const rolledBack = sessionRequests.length > 1;
        return createSessionResponse({
          viewerId: url.searchParams.get('viewerId'),
          slotId: url.searchParams.get('slotId'),
          threadId,
          messages: [
            createUserMessage('user:turn-1', 'first prompt', 'thread-ready', 'turn-1'),
            createAssistantMessage('assistant:turn-1', 'first answer', 'thread-ready', 'turn-1'),
            ...(!rolledBack
              ? [
                  createUserMessage('user:turn-2', 'second prompt', 'thread-ready', 'turn-2'),
                  createAssistantMessage('assistant:turn-2', 'second answer', 'thread-ready', 'turn-2'),
                ]
              : []),
          ],
        });
      }),
      http.post('/api/v2/thread/rollback', async ({ request }) => {
        rollbackBodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({
          kind: 'threadRolledBack',
          threadId: 'thread-ready',
          snapshot: {
            threadId: 'thread-ready',
            latestTurn: null,
            messages: [
              createUserMessage('user:turn-1', 'first prompt', 'thread-ready', 'turn-1'),
              createAssistantMessage('assistant:turn-1', 'first answer', 'thread-ready', 'turn-1'),
            ],
            notices: [],
            pendingRequests: [],
            lastError: null,
          },
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-rollback');
    window.history.replaceState({}, '', `/?slot=${'tab-rollback'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-ready');

    const user = userEvent.setup();
    render();

    await waitFor(() => expect(screen.getByText('second answer')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Thread tools' }));
    await user.click(screen.getByRole('button', { name: 'Rollback' }));

    await waitFor(() =>
      expect(rollbackBodies).toEqual([
        expect.objectContaining({
          slotId: expect.stringMatching(/^(slot|tab)-/),
          threadId: 'thread-ready',
          workspace: 'D:/workspace/example-app',
          numTurns: 1,
        }),
      ]),
    );
    await waitFor(() => expect(screen.queryByText('second answer')).toBeNull());
    expect(sessionRequests).toContain('thread-ready');
    expect(screen.getByText('first answer')).toBeInTheDocument();
  });

});
