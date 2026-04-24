import { describe, expect, it } from 'vitest';
import { parseChatTurn } from '@my-code-x/contracts';

import { loadTranscriptCache, persistTranscriptCache } from './lib/transcript-cache-storage';
import {
  HttpResponse,
  createAssistantMessage,
  createUserMessage,
  http,
  registerChatRuntimeTestEnvironment,
  renderApp as render,
  screen,
  sessionGateServer as server,
  waitFor,
} from './test/chatRuntimeTestHarness';

registerChatRuntimeTestEnvironment();

function prepareCachedSlot(slotId = 'slot-cached') {
  window.history.replaceState({}, '', `/?slot=${slotId}`);
  window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-cached');
  window.localStorage.setItem(`my-code-x-slot:${slotId}:thread-id`, 'thread-cached');
  window.localStorage.setItem(`my-code-x-slot:${slotId}:active-workspace`, 'D:/workspace/example-app');
}

function createChatTurn(status: 'completed' | 'interrupted' | 'inProgress') {
  return parseChatTurn({
    id: status === 'inProgress' ? 'turn-running' : 'turn-cached',
    status: status === 'inProgress' ? 'inProgress' : status,
    error: null,
    startedAt: null,
    completedAt: null,
    durationMs: null,
  });
}

function seedTranscriptCache(
  status: 'completed' | 'interrupted' | 'inProgress',
  workspace = 'D:/workspace/example-app',
) {
  persistTranscriptCache({
    workspace,
    threadId: 'thread-cached',
    threadName: status === 'inProgress' ? 'Running thread' : 'Cached thread',
    latestTurn: createChatTurn(status),
    messages: [
      createUserMessage('user:cached', 'cached question', 'thread-cached', 'turn-cached'),
      createAssistantMessage('assistant:cached', 'Cached answer', 'thread-cached', 'turn-cached'),
    ],
  });
}

function createCompletedBootstrapResponse(messageText = 'Live answer', threadName = 'Live thread') {
  return HttpResponse.json({
    server: { ok: true, serverInstanceId: 'gate-test', authRequired: false },
    viewer: { viewerId: 'viewer-cached', slotId: 'tab-cached' },
    session: {
      workspace: 'D:/workspace/example-app',
      threadId: 'thread-cached',
      latestTurn: {
        id: 'turn-live',
        status: 'completed',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
      threadName,
      lastUpdatedAt: '2026-04-03T12:34:56.000Z',
    },
    conversation: {
      messages: [createAssistantMessage('assistant:live', messageText, 'thread-cached', 'turn-live')],
    },
    stream: {
      url: '/api/v2/chat/events?slotId=tab-cached&threadId=thread-cached',
    },
    preferences: {},
    options: {},
  });
}

describe('ChatRuntime transcript cache', () => {
  it('renders the cached transcript and thread name before bootstrap finishes', async () => {
    let resolveBootstrap: ((createResponse: () => Response) => void) | null = null;
    const bootstrapResponse = new Promise<() => Response>(resolve => {
      resolveBootstrap = resolve;
    });

    server.use(http.get('/api/v2/session', async () => {
      const createResponse = await bootstrapResponse;
      return createResponse();
    }));

    prepareCachedSlot();
    seedTranscriptCache('completed');

    render();

    await waitFor(() => expect(screen.getByText('Cached thread')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Cached answer')).toBeInTheDocument());

    if (!resolveBootstrap) {
      throw new Error('Expected bootstrap resolver to be available.');
    }
    const completeBootstrap = resolveBootstrap as (createResponse: () => Response) => void;
    completeBootstrap(() => createCompletedBootstrapResponse());
  });

  it('replaces the cached transcript with the authoritative bootstrap transcript', async () => {
    let resolveBootstrap: ((createResponse: () => Response) => void) | null = null;
    const bootstrapResponse = new Promise<() => Response>(resolve => {
      resolveBootstrap = resolve;
    });

    server.use(http.get('/api/v2/session', async () => {
      const createResponse = await bootstrapResponse;
      return createResponse();
    }));

    prepareCachedSlot();
    seedTranscriptCache('completed');

    render();

    await waitFor(() => expect(screen.getByText('Cached answer')).toBeInTheDocument());

    if (!resolveBootstrap) {
      throw new Error('Expected bootstrap resolver to be available.');
    }
    const completeBootstrap = resolveBootstrap as (createResponse: () => Response) => void;
    completeBootstrap(() => createCompletedBootstrapResponse());

    await waitFor(() => expect(screen.getByText('Live thread')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Live answer')).toBeInTheDocument());
    expect(screen.queryByText('Cached answer')).toBeNull();
  });

  it('does not hydrate a non-completed transcript cache before bootstrap resolves', async () => {
    let resolveBootstrap: ((createResponse: () => Response) => void) | null = null;
    const bootstrapResponse = new Promise<() => Response>(resolve => {
      resolveBootstrap = resolve;
    });

    server.use(http.get('/api/v2/session', async () => {
      const createResponse = await bootstrapResponse;
      return createResponse();
    }));

    prepareCachedSlot();
    seedTranscriptCache('inProgress');

    render();

    expect(screen.queryByText('Cached answer')).toBeNull();
    expect(screen.queryByText('Running thread')).toBeNull();

    if (!resolveBootstrap) {
      throw new Error('Expected bootstrap resolver to be available.');
    }
    const completeBootstrap = resolveBootstrap as (createResponse: () => Response) => void;
    completeBootstrap(() => createCompletedBootstrapResponse('Live answer', 'Live thread'));

    await waitFor(() => expect(screen.getByText('Live answer')).toBeInTheDocument());
  });

  it('hydrates an interrupted transcript cache before bootstrap resolves', async () => {
    let resolveBootstrap: ((createResponse: () => Response) => void) | null = null;
    const bootstrapResponse = new Promise<() => Response>(resolve => {
      resolveBootstrap = resolve;
    });

    server.use(http.get('/api/v2/session', async () => {
      const createResponse = await bootstrapResponse;
      return createResponse();
    }));

    prepareCachedSlot();
    seedTranscriptCache('interrupted');

    render();

    await waitFor(() => expect(screen.getByText('Cached thread')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Cached answer')).toBeInTheDocument());

    if (!resolveBootstrap) {
      throw new Error('Expected bootstrap resolver to be available.');
    }
    const completeBootstrap = resolveBootstrap as (createResponse: () => Response) => void;
    completeBootstrap(() => createCompletedBootstrapResponse());
  });

  it('writes the authoritative completed transcript back to session storage', async () => {
    server.use(http.get('/api/v2/session', () => createCompletedBootstrapResponse('Persisted answer', 'Persisted thread')));

    prepareCachedSlot();

    render();

    await waitFor(() => expect(screen.getByText('Persisted answer')).toBeInTheDocument());

    await waitFor(() =>
      expect(loadTranscriptCache('thread-cached')).toEqual({
        workspace: 'D:/workspace/example-app',
        threadId: 'thread-cached',
        threadName: 'Persisted thread',
        latestTurn: parseChatTurn({
          id: 'turn-live',
          status: 'completed',
          error: null,
          startedAt: null,
          completedAt: null,
          durationMs: null,
        }),
        messages: [createAssistantMessage('assistant:live', 'Persisted answer', 'thread-cached', 'turn-live')],
      }),
    );
  });
});
