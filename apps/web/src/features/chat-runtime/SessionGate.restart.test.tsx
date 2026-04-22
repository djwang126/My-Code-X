import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const { reloadWindowMock } = vi.hoisted(() => ({
  reloadWindowMock: vi.fn(),
}));
const { waitForAppReadyMock } = vi.hoisted(() => ({
  waitForAppReadyMock: vi.fn(),
}));

vi.mock('../app-control', async importOriginal => {
  const actual = await importOriginal<typeof import('../app-control')>();
  return {
    ...actual,
    reloadWindow: reloadWindowMock,
    waitForAppReady: waitForAppReadyMock,
  };
});

import App from '../../app';

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

  static reset() {
    MockEventSource.instances = [];
  }
}

function createSessionResponse({ viewerId, slotId }: { viewerId: string | null; slotId: string | null }) {
  return HttpResponse.json({
    server: { ok: true, serverInstanceId: 'gate-restart-test', authRequired: false },
    viewer: { viewerId, slotId },
    session: {
      workspace: 'D:/workspace/example-app',
      threadId: 'thread-ready',
      turnExecution: {
        activeTurnId: null,
        turnLifecycle: 'idle',
      },
      lastUpdatedAt: '2026-04-03T12:34:56.000Z',
    },
    conversation: {
      messages: [],
    },
    stream: {
      url: `/api/v2/chat/events?slotId=${slotId || ''}&threadId=thread-ready`,
    },
    preferences: {
      model: 'gpt-5.1-codex',
      reasoningEffort: 'medium',
      approvalPolicy: 'never',
      sandboxMode: 'danger-full-access',
    },
    options: {
      models: [
        {
          value: 'gpt-5.1-codex',
          label: 'GPT-5.1 Codex',
          description: 'Stable default',
          reasoningEfforts: [{ value: 'medium', label: 'Medium', description: 'Balanced' }],
          defaultReasoningEffort: 'medium',
        },
      ],
      approvalPolicies: [{ value: 'never', label: 'Never', description: 'Never ask' }],
      sandboxModes: [{ value: 'danger-full-access', label: 'Danger full access', description: 'Full access' }],
    },
  });
}

const server = setupServer(
  http.get('/api/v2/session', ({ request }) => {
    const url = new URL(request.url);
    return createSessionResponse({
      viewerId: url.searchParams.get('viewerId'),
      slotId: url.searchParams.get('slotId'),
    });
  }),
  http.get('/api/v2/thread/history', ({ request }) => {
    const url = new URL(request.url);
    return HttpResponse.json({
      data: [
        {
          id: 'thread-ready',
          name: 'Restart thread',
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

beforeAll(() => {
  server.listen();
  vi.stubGlobal('EventSource', MockEventSource);
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.restoreAllMocks();
  vi.useRealTimers();
  window.sessionStorage.clear();
  window.localStorage.clear();
  MockEventSource.reset();
  reloadWindowMock.mockReset();
  waitForAppReadyMock.mockReset();
});

afterAll(() => server.close());

describe('SessionGate restart flow', () => {
  it('waits for readiness confirmation before reloading the page after restart', async () => {
    let resolveReady: (() => void) | undefined;
    waitForAppReadyMock.mockReturnValueOnce(
      new Promise<void>(resolve => {
        resolveReady = resolve;
      }),
    );

    server.use(http.post('/api/v2/app/restart', () => HttpResponse.json({ ok: true, restarting: true })));

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-ready');
    window.history.replaceState({}, '', `/?slot=${'tab-ready'}`);

    render(<App />);

    await waitFor(() => expect(screen.getByText('Session synced')).toBeInTheDocument());

    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Restart' }));

    await waitFor(() => expect(screen.getByText('Restarting My-Code-X…')).toBeInTheDocument());
    expect(waitForAppReadyMock).toHaveBeenCalledTimes(1);
    expect(waitForAppReadyMock).toHaveBeenCalledWith({
      previousServerInstanceId: 'gate-restart-test',
    });
    expect(screen.getByRole('button', { name: 'Restarting…' })).toBeDisabled();
    expect(reloadWindowMock).not.toHaveBeenCalled();

    if (resolveReady) {
      resolveReady();
    }

    await waitFor(() => expect(reloadWindowMock).toHaveBeenCalledTimes(1));
  });
});
