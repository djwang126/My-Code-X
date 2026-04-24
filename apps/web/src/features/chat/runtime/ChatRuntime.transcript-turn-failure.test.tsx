import { within } from '@testing-library/react';
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

function createTurnLevelError(message: string, { codexErrorInfo = 'other' }: { codexErrorInfo?: 'other' | null } = {}) {
  return {
    message,
    codexErrorInfo,
    additionalDetails: null,
    httpStatusCode: null,
    willRetry: false,
    threadId: 'thread-turn-failed',
    turnId: 'turn-turn-failed',
    presentationScope: 'conversation',
    source: 'error_notification',
    raw: {
      message,
    },
  };
}

function createGenericChatError(message: string) {
  return {
    message,
    codexErrorInfo: null,
    additionalDetails: null,
    httpStatusCode: null,
    willRetry: false,
    threadId: 'thread-turn-failed',
    turnId: 'turn-turn-failed',
    presentationScope: 'shared',
    source: 'request_submission',
    raw: {
      message,
    },
  };
}

describe('ChatRuntime transcript turn failure behavior', () => {
  it('renders an accepted turn-level upstream failure inside the transcript log', async () => {
    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          server: { ok: true, serverInstanceId: 'gate-test', authRequired: false },
          viewer: { viewerId: url.searchParams.get('viewerId'), slotId: url.searchParams.get('slotId') },
          session: {
            workspace: 'D:/workspace/example-app',
            threadId: 'thread-turn-failed',
            latestTurn: {
        id: 'turn-turn-failed',
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
                'user:turn-turn-failed',
                'Explain this bug',
                'thread-turn-failed',
                'turn-turn-failed',
              ),
            ],
          },
          stream: {
            url: '/api/v2/chat/events?slotId=tab-turn-failed&threadId=thread-turn-failed',
          },
          preferences: {},
          options: {},
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-turn-failed');
    window.history.replaceState({}, '', `/?slot=${'tab-turn-failed'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-turn-failed');

    render();

    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    MockEventSource.instances[0]?.emit('turn_completed', {
      threadId: 'thread-turn-failed',
      latestTurn: {
        id: 'turn-turn-failed',
        status: 'failed',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
      error: createTurnLevelError('Upstream failed after acceptance'),
    });

    const transcriptSection = screen.getByLabelText('chat transcript section');
    const transcriptLog = screen.getByRole('log', { name: 'chat transcript' });

    await waitFor(() => expect(within(transcriptLog).getByText('Explain this bug')).toBeInTheDocument());
    await waitFor(() =>
      expect(within(transcriptLog).getByText('Upstream failed after acceptance')).toBeInTheDocument(),
    );
    expect(
      within(transcriptLog).getByText('Upstream failed after acceptance').closest('.message-bubble'),
    ).not.toBeNull();
    const transcriptText = transcriptLog.textContent ?? '';
    expect(transcriptText.indexOf('Explain this bug')).toBeLessThan(
      transcriptText.indexOf('Upstream failed after acceptance'),
    );
    expect(within(transcriptSection).queryByRole('alert')).toBeNull();
  });

  it('rehydrates a failed accepted turn as transcript content instead of a transcript-wide alert', async () => {
    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          server: { ok: true, serverInstanceId: 'gate-test', authRequired: false },
          viewer: { viewerId: url.searchParams.get('viewerId'), slotId: url.searchParams.get('slotId') },
          session: {
            workspace: 'D:/workspace/example-app',
            threadId: 'thread-turn-failed',
            latestTurn: {
        id: 'turn-turn-failed',
        status: 'failed',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
            lastError: createTurnLevelError('Codex turn failed upstream'),
            lastUpdatedAt: '2026-04-03T12:34:56.000Z',
          },
          conversation: {
            messages: [
              createUserMessage(
                'user:turn-turn-failed',
                'Explain this bug',
                'thread-turn-failed',
                'turn-turn-failed',
              ),
            ],
          },
          stream: {
            url: '/api/v2/chat/events?slotId=tab-turn-failed&threadId=thread-turn-failed',
          },
          preferences: {},
          options: {},
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-turn-failed-rehydrated');
    window.history.replaceState({}, '', `/?slot=${'tab-turn-failed-rehydrated'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-turn-failed');

    render();

    await waitFor(() => expect(screen.getByText('Session synced')).toBeInTheDocument());

    const transcriptSection = screen.getByLabelText('chat transcript section');
    const transcriptLog = screen.getByRole('log', { name: 'chat transcript' });

    expect(within(transcriptLog).getByText('Explain this bug')).toBeInTheDocument();
    expect(within(transcriptLog).getByText('Codex turn failed upstream')).toBeInTheDocument();
    expect(
      within(transcriptLog).getByText('Codex turn failed upstream').closest('.message-bubble'),
    ).not.toBeNull();
    expect(within(transcriptSection).queryByRole('alert')).toBeNull();
  });

  it('rehydrates a conversation-scoped turn failure even when codexErrorInfo is null', async () => {
    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          server: { ok: true, serverInstanceId: 'gate-test', authRequired: false },
          viewer: { viewerId: url.searchParams.get('viewerId'), slotId: url.searchParams.get('slotId') },
          session: {
            workspace: 'D:/workspace/example-app',
            threadId: 'thread-turn-failed',
            latestTurn: {
        id: 'turn-turn-failed',
        status: 'failed',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
            lastError: createTurnLevelError('Missing skill metadata still stays in transcript', {
              codexErrorInfo: null,
            }),
            lastUpdatedAt: '2026-04-03T12:34:56.000Z',
          },
          conversation: {
            messages: [
              createUserMessage(
                'user:turn-turn-failed',
                'Explain this bug',
                'thread-turn-failed',
                'turn-turn-failed',
              ),
            ],
          },
          stream: {
            url: '/api/v2/chat/events?slotId=tab-turn-failed&threadId=thread-turn-failed',
          },
          preferences: {},
          options: {},
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-turn-failed-null-codex-info');
    window.history.replaceState({}, '', `/?slot=${'tab-turn-failed-null-codex-info'}`);
    window.localStorage.setItem(
      `my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`,
      'thread-turn-failed',
    );

    render();

    await waitFor(() => expect(screen.getByText('Session synced')).toBeInTheDocument());

    const transcriptSection = screen.getByLabelText('chat transcript section');
    const transcriptLog = screen.getByRole('log', { name: 'chat transcript' });

    expect(within(transcriptLog).getByText('Explain this bug')).toBeInTheDocument();
    expect(within(transcriptLog).getByText('Missing skill metadata still stays in transcript')).toBeInTheDocument();
    expect(screen.queryByRole('alert', { name: 'Chat page feedback' })).toBeNull();
    expect(within(transcriptSection).queryByRole('alert')).toBeNull();
  });

  it('keeps non-codex generic chat errors outside the transcript even after a turn was accepted', async () => {
    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          server: { ok: true, serverInstanceId: 'gate-test', authRequired: false },
          viewer: { viewerId: url.searchParams.get('viewerId'), slotId: url.searchParams.get('slotId') },
          session: {
            workspace: 'D:/workspace/example-app',
            threadId: 'thread-turn-failed',
            latestTurn: {
        id: 'turn-turn-failed',
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
                'user:turn-turn-failed',
                'Explain this bug',
                'thread-turn-failed',
                'turn-turn-failed',
              ),
            ],
          },
          stream: {
            url: '/api/v2/chat/events?slotId=tab-turn-failed&threadId=thread-turn-failed',
          },
          preferences: {},
          options: {},
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-turn-generic-error');
    window.history.replaceState({}, '', `/?slot=${'tab-turn-generic-error'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-turn-failed');

    render();

    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    MockEventSource.instances[0]?.emit('error', {
      threadId: 'thread-turn-failed',
      turnId: 'turn-turn-failed',
      error: createGenericChatError('Generic request failed after acceptance'),
    });

    const transcriptSection = screen.getByLabelText('chat transcript section');
    const transcriptLog = screen.getByRole('log', { name: 'chat transcript' });
    const globalAlert = await screen.findByRole('alert', { name: 'Chat page feedback' });

    expect(within(transcriptLog).queryByText('Generic request failed after acceptance')).toBeNull();
    expect(transcriptLog).not.toContainElement(globalAlert);
    expect(transcriptSection).not.toContainElement(globalAlert);
    expect(within(transcriptSection).queryByRole('alert')).toBeNull();
  });

  it('renders a snapshot-rehydrated turn-level upstream failure inside the transcript log', async () => {
    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          server: { ok: true, serverInstanceId: 'gate-test', authRequired: false },
          viewer: { viewerId: url.searchParams.get('viewerId'), slotId: url.searchParams.get('slotId') },
          session: {
            workspace: 'D:/workspace/example-app',
            threadId: 'thread-turn-failed',
            latestTurn: {
        id: 'turn-turn-failed',
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
                'user:turn-turn-failed',
                'Explain this bug',
                'thread-turn-failed',
                'turn-turn-failed',
              ),
            ],
          },
          stream: {
            url: '/api/v2/chat/events?slotId=tab-turn-failed&threadId=thread-turn-failed',
          },
          preferences: {},
          options: {},
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-turn-failed-snapshot');
    window.history.replaceState({}, '', `/?slot=${'tab-turn-failed-snapshot'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-turn-failed');

    render();

    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    MockEventSource.instances[0]?.emit('snapshot', {
      threadId: 'thread-turn-failed',
      latestTurn: {
        id: 'turn-turn-failed',
        status: 'failed',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
      messages: [
        createUserMessage(
          'user:turn-turn-failed',
          'Explain this bug',
          'thread-turn-failed',
          'turn-turn-failed',
        ),
      ],
      lastError: createTurnLevelError('Snapshot replay kept the turn failure'),
    });

    const transcriptSection = screen.getByLabelText('chat transcript section');
    const transcriptLog = screen.getByRole('log', { name: 'chat transcript' });

    await waitFor(() =>
      expect(within(transcriptLog).getByText('Snapshot replay kept the turn failure')).toBeInTheDocument(),
    );
    expect(
      within(transcriptLog).getByText('Snapshot replay kept the turn failure').closest('.message-bubble'),
    ).not.toBeNull();
    expect(within(transcriptSection).queryByRole('alert')).toBeNull();
  });
});
