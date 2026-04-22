import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
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

function getTranscriptNoticeElements() {
  const transcriptSection = screen.getByLabelText('chat transcript section');
  return [
    ...within(transcriptSection).queryAllByRole('status', { name: /notice$/i }),
    ...within(transcriptSection).queryAllByRole('alert', { name: /notice$/i }),
  ];
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
          id: url.searchParams.get('threadId') || 'thread-ready',
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
  MockEventSource.reset();
});
afterAll(() => server.close());

describe('SessionGate', () => {
  beforeAll(() => {
    vi.stubGlobal('EventSource', MockEventSource);
  });

  it('renders live session meta updates and system notices outside the transcript', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          server: { ok: true, serverInstanceId: 'gate-test', authRequired: false },
          viewer: { viewerId: url.searchParams.get('viewerId'), slotId: url.searchParams.get('slotId') },
          session: {
            workspace: 'D:/workspace/example-app',
            threadId: 'thread-live-meta',
            turnExecution: {
              activeTurnId: 'turn-live-meta',
              turnLifecycle: 'running',
            },
            lastUpdatedAt: '2026-04-03T12:34:56.000Z',
            threadName: '',
            threadStatusText: '',
            tokenUsageText: '',
          },
          conversation: {
            messages: [
              createUserMessage('user:turn-live-meta', 'run checks', 'thread-live-meta', 'turn-live-meta'),
            ],
          },
          stream: {
            url: '/api/v2/chat/events?slotId=tab-live-meta&threadId=thread-live-meta',
          },
          preferences: {},
          options: {},
          notices: [],
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-live-meta');
    window.history.replaceState({}, '', `/?slot=${'tab-live-meta'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-live-meta');

    render(<App />);

    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    MockEventSource.instances[0]?.emit('session_meta_updated', {
      threadId: 'thread-live-meta',
      threadName: 'Issue 9 work',
      threadStatusText: 'archived',
      tokenUsageText: 'input: 120 · output: 45 · total: 165',
    });

    MockEventSource.instances[0]?.emit('system_notice', {
      threadId: 'thread-live-meta',
      notice: {
        id: 'configWarning:latest',
        level: 'warning',
        title: 'Config warning',
        text: 'Sandbox will be tightened soon',
        raw: {
          message: 'Sandbox will be tightened soon',
        },
      },
    });

    await user.click(screen.getByRole('button', { name: 'Toggle workspace sidebar' }));
    await waitFor(() => expect(screen.getByText('Issue 9 work')).toBeInTheDocument());
    expect(getTranscriptNoticeElements()).toHaveLength(0);
    const toastRegion = screen.getByRole('region', { name: 'Session toasts' });
    expect(within(toastRegion).getByText('Config warning')).toBeInTheDocument();
    expect(within(toastRegion).getByText('Sandbox will be tightened soon')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Toggle tools sidebar' }));
    expect(screen.getByText('Token usage')).toBeInTheDocument();
    expect(screen.getByText('input: 120 · output: 45 · total: 165')).toBeInTheDocument();
    expect(screen.getAllByText('run checks')).toHaveLength(1);
  });

});
