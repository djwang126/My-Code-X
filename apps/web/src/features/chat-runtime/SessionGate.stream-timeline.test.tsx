import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import App from '../../app';
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
      turnExecution: {
        activeTurnId: null,
        turnLifecycle: 'idle',
      },
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
  vi.useRealTimers();
  window.sessionStorage.clear();
  window.localStorage.clear();
  MockEventSource.reset();
});
afterAll(() => server.close());

describe('SessionGate', () => {
  beforeAll(() => {
    vi.stubGlobal('EventSource', MockEventSource);
  });

  it('subscribes to live chat events for in-progress turns and unlocks the composer on completion', async () => {
    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          server: { ok: true, serverInstanceId: 'gate-test', authRequired: false },
          viewer: { viewerId: url.searchParams.get('viewerId'), slotId: url.searchParams.get('slotId') },
          session: {
            workspace: 'D:/workspace/example-app',
            threadId: 'thread-live',
            turnExecution: {
              activeTurnId: 'turn-live',
              turnLifecycle: 'running',
            },
            lastUpdatedAt: '2026-04-03T12:34:56.000Z',
          },
          conversation: {
            messages: [
              createUserMessage('user:turn-live', 'status?', 'thread-live', 'turn-live'),
              createAssistantMessage('assistant:turn-live', 'still thinking', 'thread-live', 'turn-live', 'streaming'),
            ],
          },
          stream: {
            url: '/api/v2/chat/events?slotId=tab-live&threadId=thread-live',
          },
          preferences: {},
          options: {},
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-live');
    window.history.replaceState({}, '', `/?slot=${'tab-live'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-live');

    render(<App />);

    await waitFor(() => expect(screen.getByText('still thinking')).toBeInTheDocument());
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    const stream = MockEventSource.instances[0];
    expect(stream?.url).toBe('/api/v2/chat/events?slotId=tab-live&threadId=thread-live');
    expect(screen.getByRole('button', { name: 'Stop' })).toBeEnabled();

    stream?.emit('snapshot', {
      threadId: 'thread-live',
      turnExecution: {
        activeTurnId: 'turn-live',
        turnLifecycle: 'running',
      },
      messages: [
        createUserMessage('user:turn-live', 'status?', 'thread-live', 'turn-live'),
        createAssistantMessage('assistant:turn-live', 'new partial', 'thread-live', 'turn-live', 'streaming'),
      ],
    });

    await waitFor(() => expect(screen.getByText('new partial')).toBeInTheDocument());
    expect(screen.queryByText('still thinking')).not.toBeInTheDocument();

    stream?.emit('assistant_delta', {
      threadId: 'thread-live',
      turnId: 'turn-live',
      messageId: 'assistant:turn-live',
      delta: ' plus more',
      text: 'new partial plus more',
    });

    await waitFor(() => expect(screen.getByText('new partial plus more')).toBeInTheDocument());

    stream?.emit('message_completed', {
      threadId: 'thread-live',
      turnId: 'turn-live',
      message: {
        ...createAssistantMessage('assistant:turn-live', 'done now', 'thread-live', 'turn-live'),
      },
    });

    await waitFor(() => expect(screen.getByText('done now')).toBeInTheDocument());

    stream?.emit('turn_completed', {
      threadId: 'thread-live',
      turnExecution: {
        activeTurnId: 'turn-live',
        turnLifecycle: 'completed',
      },
    });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled());
    await waitFor(() => expect(stream?.closed).toBe(true));
  });

  it('batches rapid assistant_delta updates before dispatching to the transcript', async () => {
    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          server: { ok: true, serverInstanceId: 'gate-test', authRequired: false },
          viewer: { viewerId: url.searchParams.get('viewerId'), slotId: url.searchParams.get('slotId') },
          session: {
            workspace: 'D:/workspace/example-app',
            threadId: 'thread-live-batched',
            turnExecution: {
              activeTurnId: 'turn-live-batched',
              turnLifecycle: 'running',
            },
            lastUpdatedAt: '2026-04-03T12:34:56.000Z',
          },
          conversation: {
            messages: [
              createUserMessage('user:turn-live-batched', 'status?', 'thread-live-batched', 'turn-live-batched'),
              createAssistantMessage(
                'assistant:turn-live-batched',
                'start',
                'thread-live-batched',
                'turn-live-batched',
                'streaming',
              ),
            ],
          },
          stream: {
            url: '/api/v2/chat/events?slotId=tab-live-batched&threadId=thread-live-batched',
          },
          preferences: {},
          options: {},
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-live-batched');
    window.history.replaceState({}, '', `/?slot=${'tab-live-batched'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-live-batched');

    render(<App />);

    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    vi.useFakeTimers();

    const stream = MockEventSource.instances[0];

    stream?.emit('assistant_delta', {
      threadId: 'thread-live-batched',
      turnId: 'turn-live-batched',
      messageId: 'assistant:turn-live-batched',
      delta: ' A',
      text: 'start A',
    });
    stream?.emit('assistant_delta', {
      threadId: 'thread-live-batched',
      turnId: 'turn-live-batched',
      messageId: 'assistant:turn-live-batched',
      delta: ' B',
      text: 'start A B',
    });
    stream?.emit('assistant_delta', {
      threadId: 'thread-live-batched',
      turnId: 'turn-live-batched',
      messageId: 'assistant:turn-live-batched',
      delta: ' C',
      text: 'start A B C',
    });

    expect(screen.queryByText('start A B C')).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(40);
    });

    expect(screen.getByText('start A B C')).toBeInTheDocument();
    expect(screen.queryByText('start A')).not.toBeInTheDocument();
  });

  it('renders special timeline rows delivered through a live snapshot event', async () => {
    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          server: { ok: true, serverInstanceId: 'gate-test', authRequired: false },
          viewer: { viewerId: url.searchParams.get('viewerId'), slotId: url.searchParams.get('slotId') },
          session: {
            workspace: 'D:/workspace/example-app',
            threadId: 'thread-special-live',
            turnExecution: {
              activeTurnId: 'turn-special-live',
              turnLifecycle: 'running',
            },
            lastUpdatedAt: '2026-04-03T12:34:56.000Z',
          },
          conversation: {
            messages: [
              {
                id: 'user:turn-special-live',
                kind: 'message',
                itemType: 'userMessage',
                role: 'user',
                text: 'run checks',
                state: 'complete',
                threadId: 'thread-special-live',
                turnId: 'turn-special-live',
              },
            ],
          },
          stream: {
            url: '/api/v2/chat/events?slotId=tab-special-live&threadId=thread-special-live',
          },
          preferences: {},
          options: {},
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-special-live');
    window.history.replaceState({}, '', `/?slot=${'tab-special-live'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-special-live');

    render(<App />);

    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    MockEventSource.instances[0]?.emit('snapshot', {
      threadId: 'thread-special-live',
      turnExecution: {
        activeTurnId: 'turn-special-live',
        turnLifecycle: 'running',
      },
      messages: [
        {
          id: 'user:turn-special-live',
          kind: 'message',
          itemType: 'userMessage',
          role: 'user',
          text: 'run checks',
          state: 'complete',
          threadId: 'thread-special-live',
          turnId: 'turn-special-live',
        },
        {
          id: 'plan-1',
          kind: 'special',
          itemType: 'plan',
          text: 'Inspect reducer state',
          state: 'streaming',
          threadId: 'thread-special-live',
          turnId: 'turn-special-live',
          raw: {
            type: 'plan',
            id: 'plan-1',
            text: 'Inspect reducer state',
          },
        },
      ],
    });

    await waitFor(() => expect(screen.getByText('Plan')).toBeInTheDocument());
    expect(screen.getByText('Inspect reducer state')).toBeInTheDocument();
  });

  it('keeps resumed fallback media visible while live updates and threadless requests resolve', async () => {
    const requestBodies: Array<Record<string, unknown>> = [];

    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          server: { ok: true, serverInstanceId: 'gate-test', authRequired: false },
          viewer: { viewerId: url.searchParams.get('viewerId'), slotId: url.searchParams.get('slotId') },
          session: {
            workspace: 'D:/workspace/example-app',
            threadId: 'thread-issue-8',
            turnExecution: {
              activeTurnId: 'turn-issue-8',
              turnLifecycle: 'running',
            },
            lastUpdatedAt: '2026-04-04T12:34:56.000Z',
          },
          conversation: {
            messages: [
              {
                id: 'user:turn-issue-8',
                kind: 'message',
                itemType: 'userMessage',
                role: 'user',
                text: 'continue the resumed session',
                state: 'complete',
                threadId: 'thread-issue-8',
                turnId: 'turn-issue-8',
              },
              {
                id: 'image-generation-1',
                kind: 'fallback',
                itemType: 'imageGeneration',
                text: '[imageGeneration]',
                state: 'streaming',
                threadId: 'thread-issue-8',
                turnId: 'turn-issue-8',
                raw: {
                  type: 'imageGeneration',
                  id: 'image-generation-1',
                  prompt: 'Generate a mobile mockup',
                },
              },
            ],
          },
          stream: {
            url: '/api/v2/chat/events?slotId=tab-issue-8&threadId=thread-issue-8',
          },
          preferences: {},
          options: {},
          pendingRequests: [],
        });
      }),
      http.post('/api/v2/server-requests/respond', async ({ request }) => {
        requestBodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ ok: true, requestId: 'req-auth-issue-8' });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-issue-8');
    window.history.replaceState({}, '', `/?slot=${'tab-issue-8'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-issue-8');

    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
    expect(screen.getByText('[imageGeneration]')).toBeInTheDocument();

    MockEventSource.instances[0]?.emit('future_notification', {
      threadId: 'thread-issue-8',
      payload: { ignored: true },
    });

    MockEventSource.instances[0]?.emit('timeline_item_updated', {
      threadId: 'thread-issue-8',
      turnId: 'turn-issue-8',
      item: {
        id: 'image-view-1',
        kind: 'fallback',
        itemType: 'imageView',
        text: '[imageView]',
        state: 'complete',
        threadId: 'thread-issue-8',
        turnId: 'turn-issue-8',
        raw: {
          type: 'imageView',
          id: 'image-view-1',
          imageUrl: 'https://example.com/mock.png',
        },
      },
    });

    MockEventSource.instances[0]?.emit('pending_request_updated', {
      threadId: '',
      request: {
        id: 'req-auth-issue-8',
        method: 'account/chatgptAuthTokens/refresh',
        kind: 'auth_refresh',
        threadId: '',
        turnId: null,
        title: 'Refresh ChatGPT authentication',
        prompt: 'Codex needs refreshed ChatGPT credentials.',
        previousAccountId: 'acct-8',
        submitState: 'idle',
        raw: {
          reason: 'unauthorized',
        },
      },
    });

    await waitFor(() => expect(screen.getByText('[imageView]')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Refresh ChatGPT authentication')).toBeInTheDocument());

    await user.type(screen.getByRole('textbox', { name: 'Access token' }), 'token-issue-8');
    await user.clear(screen.getByRole('textbox', { name: 'Account id' }));
    await user.type(screen.getByRole('textbox', { name: 'Account id' }), 'acct-8');
    await user.click(screen.getByRole('button', { name: 'Submit tokens' }));

    await waitFor(() =>
      expect(requestBodies).toEqual([
        expect.objectContaining({
          slotId: expect.stringMatching(/^(slot|tab)-/),
          threadId: '',
          requestId: 'req-auth-issue-8',
          response: {
            accessToken: 'token-issue-8',
            chatgptAccountId: 'acct-8',
          },
        }),
      ]),
    );

    MockEventSource.instances[0]?.emit('pending_request_resolved', {
      threadId: '',
      requestId: 'req-auth-issue-8',
      notice: {
        id: 'serverRequest/resolved:req-auth-issue-8',
        level: 'info',
        title: 'Request resolved',
        text: 'Resolved request req-auth-issue-8',
      },
    });

    await waitFor(() => expect(screen.getByText('Resolved request req-auth-issue-8')).toBeInTheDocument());
    expect(screen.getByText('[imageGeneration]')).toBeInTheDocument();
    expect(screen.getByText('[imageView]')).toBeInTheDocument();
    expect(screen.queryByText('Refresh ChatGPT authentication')).not.toBeInTheDocument();
  });

  it('reconciles live timeline_item_updated events in place for existing special rows', async () => {
    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          server: { ok: true, serverInstanceId: 'gate-test', authRequired: false },
          viewer: { viewerId: url.searchParams.get('viewerId'), slotId: url.searchParams.get('slotId') },
          session: {
            workspace: 'D:/workspace/example-app',
            threadId: 'thread-live-updated',
            turnExecution: {
              activeTurnId: 'turn-live-updated',
              turnLifecycle: 'running',
            },
            lastUpdatedAt: '2026-04-03T12:34:56.000Z',
          },
          conversation: {
            messages: [
              createUserMessage('user:turn-live-updated', 'run checks', 'thread-live-updated', 'turn-live-updated'),
            ],
          },
          stream: {
            url: '/api/v2/chat/events?slotId=tab-live-updated&threadId=thread-live-updated',
          },
          preferences: {},
          options: {},
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-live-updated');
    window.history.replaceState({}, '', `/?slot=${'tab-live-updated'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-live-updated');

    render(<App />);

    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    MockEventSource.instances[0]?.emit('timeline_item_updated', {
      threadId: 'thread-live-updated',
      turnId: 'turn-live-updated',
      item: {
        id: 'plan-1',
        kind: 'special',
        itemType: 'plan',
        text: 'Inspect reducer state',
        state: 'streaming',
        threadId: 'thread-live-updated',
        turnId: 'turn-live-updated',
        raw: {
          type: 'plan',
          id: 'plan-1',
          text: 'Inspect reducer state',
        },
      },
    });

    await waitFor(() => expect(screen.getByText('Inspect reducer state')).toBeInTheDocument());

    MockEventSource.instances[0]?.emit('timeline_item_updated', {
      threadId: 'thread-live-updated',
      turnId: 'turn-live-updated',
      item: {
        id: 'plan-1',
        kind: 'special',
        itemType: 'plan',
        text: 'Inspect updated reducer state',
        state: 'complete',
        threadId: 'thread-live-updated',
        turnId: 'turn-live-updated',
        raw: {
          type: 'plan',
          id: 'plan-1',
          text: 'Inspect updated reducer state',
        },
      },
    });

    await waitFor(() => expect(screen.getByText('Inspect updated reducer state')).toBeInTheDocument());
    expect(screen.queryByText('Inspect reducer state')).toBeNull();
    expect(screen.getAllByText('Plan')).toHaveLength(1);
  });
});
