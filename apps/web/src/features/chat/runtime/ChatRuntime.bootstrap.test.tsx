import { StrictMode } from 'react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import App from '../../../app';
import type { SessionTimelineMessageItem, SessionTimelineItem } from './session-types';

class MockEventSource {
  static instances: MockEventSource[] = [];

  readonly url: string;
  readonly listeners = new Map<string, Set<(event: Event) => void>>();
  closed = false;

  constructor(url: string | URL) {
    this.url = String(url);
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: Event) => void) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: (event: Event) => void) {
    this.listeners.get(type)?.delete(listener);
  }

  close() {
    this.closed = true;
  }

  emit(type: string, payload: unknown) {
    const event = new MessageEvent(type, {
      data: JSON.stringify(payload),
    });
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }

  static reset() {
    MockEventSource.instances = [];
  }
}

function createMessageItem({
  id,
  role,
  text,
  state = 'complete',
  threadId,
  turnId,
}: {
  id: string;
  role: SessionTimelineMessageItem['role'];
  text: string;
  state?: SessionTimelineMessageItem['state'];
  threadId: string;
  turnId: string;
}): SessionTimelineMessageItem {
  return {
    id,
    kind: 'message',
    itemType: role === 'assistant' ? 'agentMessage' : 'userMessage',
    role,
    text,
    state,
    threadId,
    turnId,
  };
}

function createUserMessage(id: string, text: string, threadId: string, turnId: string): SessionTimelineMessageItem {
  return createMessageItem({ id, role: 'user', text, threadId, turnId });
}

function createAssistantMessage(
  id: string,
  text: string,
  threadId: string,
  turnId: string,
  state: SessionTimelineMessageItem['state'] = 'complete',
): SessionTimelineMessageItem {
  return createMessageItem({ id, role: 'assistant', text, state, threadId, turnId });
}

function createSessionResponse({
  viewerId,
  slotId,
  threadId = 'thread-ready',
  workspace = 'D:/workspace/example-app',
  messages,
  pendingRequests = [],
  preferences = {
    model: 'gpt-5.1-codex',
    reasoningEffort: 'medium',
    approvalPolicy: 'never',
    sandboxMode: 'danger-full-access',
  },
  options = {
    models: [
      {
        value: 'gpt-5.1-codex',
        label: 'GPT-5.1 Codex',
        description: 'Stable default',
        reasoningEfforts: [
          { value: 'medium', label: 'Medium', description: 'Balanced' },
          { value: 'high', label: 'High', description: 'More reasoning' },
        ],
        defaultReasoningEffort: 'medium',
      },
      {
        value: 'gpt-5.4',
        label: 'GPT-5.4',
        description: 'Latest',
        reasoningEfforts: [
          { value: 'high', label: 'High', description: 'Deep reasoning' },
          { value: 'xhigh', label: 'Extra high', description: 'Deepest reasoning' },
        ],
        defaultReasoningEffort: 'high',
      },
    ],
    approvalPolicies: [
      { value: 'never', label: 'Never', description: 'Never ask' },
      { value: 'on-request', label: 'On request', description: 'Ask when requested' },
    ],
    sandboxModes: [
      { value: 'danger-full-access', label: 'Danger full access', description: 'Full access' },
      { value: 'workspace-write', label: 'Workspace write', description: 'Workspace only' },
    ],
  },
}: {
  viewerId: string | null;
  slotId: string | null;
  threadId?: string;
  workspace?: string;
  messages?: SessionTimelineItem[];
  pendingRequests?: Array<Record<string, unknown>>;
  preferences?: Record<string, unknown>;
  options?: Record<string, unknown>;
}) {
  const transcriptTurnId = 'turn-ready';

  return HttpResponse.json({
    server: { ok: true, serverInstanceId: 'gate-test', authRequired: false },
    viewer: { viewerId, slotId },
    session: {
      workspace,
      threadId,
      latestTurn: null,
      lastUpdatedAt: '2026-04-03T12:34:56.000Z',
    },
    conversation: {
      messages:
        messages ??
        [
          createUserMessage('user:turn-ready', 'hello', threadId, transcriptTurnId),
          createAssistantMessage('assistant:turn-ready', 'hi there', threadId, transcriptTurnId),
        ],
    },
    stream: {
      url: `/api/v2/chat/events?slotId=${slotId || ''}&threadId=${threadId}`,
    },
    pendingRequests,
    preferences,
    options,
  });
}

const server = setupServer(
  http.get('/api/v2/session', ({ request }) => {
    const url = new URL(request.url);
    if (url.searchParams.get('viewerId') === 'viewer-auth') {
      return new HttpResponse(null, { status: 401 });
    }
    if (url.searchParams.get('viewerId') === 'viewer-error') {
      return new HttpResponse('thread/resume failed: thread not found', {
        status: 502,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
    return createSessionResponse({
      viewerId: url.searchParams.get('viewerId'),
      slotId: url.searchParams.get('slotId'),
      threadId: url.searchParams.get('threadId') || 'thread-ready',
    });
  }),
  http.get('/api/v2/thread/history', ({ request }) => {
    const url = new URL(request.url);
    return HttpResponse.json({
      data: [
        {
          id: 'thread-ready',
          name: 'Ready thread',
          preview: 'hello',
          workspace: url.searchParams.get('workspace') || '',
          createdAt: 1_744_000_000,
          updatedAt: 1_744_000_500,
          statusText: 'idle',
        },
      ],
    });
  }),
);

beforeAll(() => server.listen());
afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
  window.localStorage.clear();
  window.history.replaceState({}, '', '/');
  window.name = '';
  MockEventSource.reset();
});
afterAll(() => server.close());

async function openWorkspaceNavigation(user?: ReturnType<typeof userEvent.setup>) {
  if (user) {
    await user.click(screen.getByRole('button', { name: 'Toggle workspace sidebar' }));
  } else {
    screen.getByRole('button', { name: 'Toggle workspace sidebar' }).click();
  }
}

describe('ChatRuntime', () => {
  beforeAll(() => {
    vi.stubGlobal('EventSource', MockEventSource);
  });

  it('bootstraps from empty storage when randomUUID is unavailable and persists a generated viewer id', async () => {
    const originalCrypto = window.crypto;
    const requestedViewerIds: string[] = [];
    const requestedSlotIds: string[] = [];

    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        const viewerId = url.searchParams.get('viewerId') ?? '';
        const slotId = url.searchParams.get('slotId') ?? '';
        requestedViewerIds.push(viewerId);
        requestedSlotIds.push(slotId);
        return createSessionResponse({ viewerId, slotId, messages: [], threadId: 'thread-ready' });
      }),
    );

    Object.defineProperty(window, 'crypto', {
      configurable: true,
      value: {
        ...originalCrypto,
        randomUUID: undefined,
      },
    });

    render(<App />);

    await waitFor(() => expect(screen.getByText('Session synced')).toBeInTheDocument());

    const viewerId = window.sessionStorage.getItem('my-code-x-viewer-id');
    expect(viewerId).toMatch(/^viewer-/);
    expect(requestedViewerIds).toEqual([viewerId]);
    expect(requestedSlotIds[0]).toMatch(/^slot-/);
    expect(new URL(window.location.href).searchParams.get('slot')).toBe(requestedSlotIds[0]);
    expect(window.sessionStorage.getItem('my-code-x-tab-id')).toBeNull();

    Object.defineProperty(window, 'crypto', {
      configurable: true,
      value: originalCrypto,
    });
  });

  it('reuses the same slot id and stored thread id on same-slot reload restore', async () => {
    const requestThreads: string[] = [];
    const requestTabs: string[] = [];

    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        requestTabs.push(url.searchParams.get('slotId') ?? '');
        requestThreads.push(url.searchParams.get('threadId') ?? '');
        return createSessionResponse({
          viewerId: url.searchParams.get('viewerId'),
          slotId: url.searchParams.get('slotId'),
          threadId: url.searchParams.get('threadId') || 'thread-restored',
          messages: [],
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-ready');
    window.history.replaceState({}, '', '/?slot=slot-ready');
    window.localStorage.setItem('my-code-x-slot:slot-ready:thread-id', 'thread-restored');

    render(<App />);
    await waitFor(() => expect(screen.getByText('Session synced')).toBeInTheDocument());

    cleanup();
    render(<App />);
    await waitFor(() => expect(requestThreads).toEqual(['thread-restored', 'thread-restored']));
    expect(requestTabs).toEqual(['slot-ready', 'slot-ready']);
  });

  it('uses the slot from the URL and keeps the stored thread id during bootstrap', async () => {
    const requestedTabs: string[] = [];
    const requestedThreads: string[] = [];

    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        requestedTabs.push(url.searchParams.get('slotId') ?? '');
        requestedThreads.push(url.searchParams.get('threadId') ?? '');
        return createSessionResponse({
          viewerId: url.searchParams.get('viewerId'),
          slotId: url.searchParams.get('slotId'),
          threadId: 'thread-fresh',
          messages: [],
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-dup');
    window.history.replaceState({}, '', `/?slot=${'tab-cloned'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-cloned');

    render(<App />);

    await waitFor(() => expect(screen.getByText('Session synced')).toBeInTheDocument());
    expect(requestedTabs).toHaveLength(1);
    expect(requestedTabs[0]).toBe('tab-cloned');
    expect(requestedThreads).toEqual(['thread-cloned']);
    expect(new URL(window.location.href).searchParams.get('slot')).toBe('tab-cloned');
  });

  it('continues bootstrapping when sessionStorage access fails', async () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });

    render(<App />);

    await waitFor(() => expect(screen.getByText('Session synced')).toBeInTheDocument());

    getItemSpy.mockRestore();
    setItemSpy.mockRestore();
    expect(window.sessionStorage.getItem('my-code-x-viewer-id')).toBeNull();
    expect(new URL(window.location.href).searchParams.get('slot')).toMatch(/^slot-/);
  });

  it('renders the ready shell after bootstrap succeeds', async () => {
    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-ready');
    window.history.replaceState({}, '', `/?slot=${'tab-ready'}`);
    render(<App />);

    await waitFor(() => expect(screen.getByText('Session synced')).toBeInTheDocument());
    await openWorkspaceNavigation();
    expect(screen.getByText('D:/workspace/example-app')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Ready thread')).toBeInTheDocument());
    expect(screen.getAllByText('hello').length).toBeGreaterThan(0);
    expect(screen.getByText('hi there')).toBeInTheDocument();
    expect(window.localStorage.getItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`)).toBe('thread-ready');
  });

  it('loads workspace workspace threads and resumes a selected thread from the sidebar', async () => {
    const requestedThreads: string[] = [];

    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        const threadId = url.searchParams.get('threadId') || 'thread-ready';
        requestedThreads.push(threadId);

        return createSessionResponse({
          viewerId: url.searchParams.get('viewerId'),
          slotId: url.searchParams.get('slotId'),
          threadId,
          messages: [],
        });
      }),
      http.get('/api/v2/thread/history', ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          data: [
            {
              id: 'thread-older',
              name: 'Older thread',
              preview: 'resume me',
              workspace: url.searchParams.get('workspace') || '',
              createdAt: 1_744_000_000,
              updatedAt: 1_744_000_400,
              statusText: 'completed',
            },
            {
              id: 'thread-ready',
              name: 'Current thread',
              preview: 'active',
              workspace: url.searchParams.get('workspace') || '',
              createdAt: 1_744_000_100,
              updatedAt: 1_744_000_500,
              statusText: 'idle',
            },
          ],
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-history');
    window.history.replaceState({}, '', `/?slot=${'tab-history'}`);

    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => expect(screen.getByText('Session synced')).toBeInTheDocument());
    await openWorkspaceNavigation(user);
    await user.click(screen.getByRole('button', { name: /Older thread/i }));

    await waitFor(() => expect(requestedThreads).toEqual(['thread-ready', 'thread-older']));
    expect(window.localStorage.getItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`)).toBe('thread-older');
  });

  it('blocks resuming another thread while pending requests keep the current turn waiting', async () => {
    const requestedThreads: string[] = [];

    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        const threadId = url.searchParams.get('threadId') || 'thread-ready';
        requestedThreads.push(threadId);

        return createSessionResponse({
          viewerId: url.searchParams.get('viewerId'),
          slotId: url.searchParams.get('slotId'),
          threadId,
          messages: [],
          pendingRequests:
            threadId === 'thread-ready'
              ? [
                  {
                    id: 'req-user-input',
                    method: 'item/tool/requestUserInput',
                    kind: 'user_input',
                    threadId: 'thread-ready',
                    turnId: 'turn-ready',
                    title: 'Answer 1 question',
                    prompt: '',
                    questions: [
                      {
                        id: 'environment',
                        header: 'Env',
                        question: 'Which environment should I use?',
                        options: [{ label: 'Staging', description: 'Use staging' }],
                      },
                    ],
                    submitState: 'idle',
                    raw: {},
                  },
                ]
              : [],
        });
      }),
      http.get('/api/v2/thread/history', ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          data: [
            {
              id: 'thread-older',
              name: 'Older thread',
              preview: 'resume me',
              workspace: url.searchParams.get('workspace') || '',
              createdAt: 1_744_000_000,
              updatedAt: 1_744_000_400,
              statusText: 'completed',
            },
            {
              id: 'thread-ready',
              name: 'Current thread',
              preview: 'active',
              workspace: url.searchParams.get('workspace') || '',
              createdAt: 1_744_000_100,
              updatedAt: 1_744_000_500,
              statusText: 'idle',
            },
          ],
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-history-pending');
    window.history.replaceState({}, '', `/?slot=${'tab-history-pending'}`);

    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => expect(screen.getByText('Session synced')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Answer 1 question')).toBeInTheDocument());
    await openWorkspaceNavigation(user);
    await user.click(screen.getByRole('button', { name: /Older thread/i }));

    await waitFor(() => expect(requestedThreads).toEqual(['thread-ready']));
    expect(window.localStorage.getItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`)).toBe('thread-ready');
  });

  it('renders resumed non-media timeline items returned during bootstrap', async () => {
    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        return createSessionResponse({
          viewerId: url.searchParams.get('viewerId'),
          slotId: url.searchParams.get('slotId'),
          threadId: 'thread-resumed-special',
          messages: [
            {
              id: 'user-1',
              kind: 'message',
              itemType: 'userMessage',
              role: 'user',
              text: 'Use\n\n[skill: playwright]\n\n[mention: repo]',
              state: 'complete',
              threadId: 'thread-resumed-special',
              turnId: 'turn-resumed-special',
              content: [
                { type: 'text', text: 'Use' },
                { type: 'skill', name: 'playwright', path: 'skill://playwright' },
                { type: 'mention', name: 'repo', path: 'app://repo' },
              ],
            },
            {
              id: 'hook-1',
              kind: 'special',
              itemType: 'hookPrompt',
              text: 'System safety hook',
              state: 'complete',
              threadId: 'thread-resumed-special',
              turnId: 'turn-resumed-special',
              raw: { type: 'hookPrompt', id: 'hook-1', fragments: [{ text: 'System safety hook' }] },
            },
            {
              id: 'cmd-1',
              kind: 'special',
              itemType: 'commandExecution',
              text: 'npm test',
              state: 'complete',
              threadId: 'thread-resumed-special',
              turnId: 'turn-resumed-special',
              status: 'completed',
              raw: {
                type: 'commandExecution',
                id: 'cmd-1',
                command: 'npm test',
                cwd: 'D:/workspace/example-app',
                status: 'completed',
                exitCode: 0,
                durationMs: 1500,
              },
            },
            {
              id: 'review-1',
              kind: 'special',
              itemType: 'enteredReviewMode',
              text: 'current changes',
              state: 'complete',
              threadId: 'thread-resumed-special',
              turnId: 'turn-resumed-special',
              raw: {
                type: 'enteredReviewMode',
                id: 'review-1',
                review: 'current changes',
              },
            },
          ],
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-resumed-special');
    window.history.replaceState({}, '', `/?slot=${'tab-resumed-special'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-resumed-special');

    render(<App />);

    await waitFor(() => expect(screen.getByText('Session synced')).toBeInTheDocument());
    expect(screen.getByLabelText('skill playwright')).toBeInTheDocument();
    expect(screen.getByLabelText('mention repo')).toBeInTheDocument();
    expect(screen.getByText('Hook prompt')).toBeInTheDocument();
    expect(screen.getByText('Command execution')).toBeInTheDocument();
    expect(screen.getByText('Entered review mode')).toBeInTheDocument();
  });

  it('clears a previously stored thread id when bootstrap returns an empty thread', async () => {
    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        return createSessionResponse({
          viewerId: url.searchParams.get('viewerId'),
          slotId: url.searchParams.get('slotId'),
          threadId: '',
          messages: [],
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-ready');
    window.history.replaceState({}, '', `/?slot=${'tab-ready'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-stale');

    render(<App />);

    await waitFor(() => expect(screen.getByText('Session synced')).toBeInTheDocument());
    expect(window.localStorage.getItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`)).toBeNull();
  });

  it('renders the auth-required state when the API returns 401', async () => {
    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-auth');
    window.history.replaceState({}, '', `/?slot=${'tab-auth'}`);
    render(<App />);

    await waitFor(() => expect(screen.getByText('Access token required')).toBeInTheDocument());
  });

  it('renders the raw backend error text when bootstrap fails', async () => {
    server.use(
      http.get('/api/v2/session', () => {
        return new HttpResponse('no rollout found for thread id thread-missing', {
          status: 502,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-error');
    window.history.replaceState({}, '', `/?slot=${'tab-error'}`);
    render(<App />);

    await waitFor(() =>
      expect(screen.getByText('no rollout found for thread id thread-missing')).toBeInTheDocument(),
    );
    expect(screen.queryByText('Load failed')).not.toBeInTheDocument();
    expect(screen.queryByText('Session restore failed')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('lets the user start fresh after restore fails by clearing the stale thread id and retrying bootstrap', async () => {
    const requestedThreads: string[] = [];

    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        const threadId = url.searchParams.get('threadId') || '';
        requestedThreads.push(threadId);

        if (threadId === 'thread-stale') {
          return new HttpResponse('no rollout found for thread id thread-stale', {
            status: 502,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        }

        return createSessionResponse({
          viewerId: url.searchParams.get('viewerId'),
          slotId: url.searchParams.get('slotId'),
          threadId: '',
          messages: [],
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-fresh');
    window.history.replaceState({}, '', `/?slot=${'tab-fresh'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-stale');

    const user = userEvent.setup();
    render(<App />);

    await waitFor(() =>
      expect(screen.getByText('no rollout found for thread id thread-stale')).toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: 'Start over' }));

    await waitFor(() => expect(screen.getByText('Session synced')).toBeInTheDocument());
    expect(requestedThreads).toEqual(['thread-stale', '']);
    expect(window.localStorage.getItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`)).toBeNull();
  });

  it('retries session restore without clearing the saved thread id', async () => {
    const requestedThreads: string[] = [];
    let attempts = 0;

    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        const threadId = url.searchParams.get('threadId') || '';
        requestedThreads.push(threadId);
        attempts += 1;

        if (attempts === 1) {
          return new HttpResponse('no rollout found for thread id thread-stale', {
            status: 502,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        }

        return createSessionResponse({
          viewerId: url.searchParams.get('viewerId'),
          slotId: url.searchParams.get('slotId'),
          threadId,
          messages: [],
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-retry');
    window.history.replaceState({}, '', `/?slot=${'tab-retry'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-stale');

    const user = userEvent.setup();
    render(<App />);

    await waitFor(() =>
      expect(screen.getByText('no rollout found for thread id thread-stale')).toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.getByText('Session synced')).toBeInTheDocument());
    expect(requestedThreads).toEqual(['thread-stale', 'thread-stale']);
    expect(window.localStorage.getItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`)).toBe('thread-stale');
  });

  it('finishes bootstrap cleanly after StrictMode remount', async () => {
    const responses: Array<(value: ReturnType<typeof createSessionResponse>) => void> = [];

    server.use(
      http.get('/api/v2/session', () => {
        return new Promise(resolve => {
          responses.push(resolve);
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-strict');
    window.history.replaceState({}, '', `/?slot=${'tab-strict'}`);
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    await waitFor(() => expect(responses).toHaveLength(1));

    responses[0](
      createSessionResponse({
        viewerId: 'viewer-strict',
        slotId: 'tab-strict',
        threadId: 'thread-newer',
        workspace: 'D:/workspace/example-app/newer',
        messages: [],
      }),
    );

    await openWorkspaceNavigation();
    await waitFor(() =>
      expect(screen.getByText('D:/workspace/example-app/newer')).toBeInTheDocument(),
    );

    responses[0](
      createSessionResponse({
        viewerId: 'viewer-strict',
        slotId: 'tab-strict',
        threadId: 'thread-stale',
        workspace: 'D:/workspace/example-app/stale',
        messages: [],
      }),
    );

    await waitFor(() =>
      expect(screen.queryByText('D:/workspace/example-app/stale')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('D:/workspace/example-app/newer')).toBeInTheDocument();
  });
});
