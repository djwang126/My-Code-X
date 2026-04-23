import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import App from '../../../app';

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

const saveRequestBodies: Array<Record<string, unknown>> = [];

function createSessionResponse({
  viewerId,
  slotId,
  messages = [],
}: {
  viewerId: string | null;
  slotId: string | null;
  messages?: Array<Record<string, unknown>>;
}) {
  return HttpResponse.json({
    server: { ok: true, serverInstanceId: 'gate-file-explorer-test', authRequired: false },
    viewer: { viewerId, slotId },
    session: {
      workspace: 'D:/workspace/example-app',
      threadId: 'thread-ready',
      turnExecution: {
        activeTurnId: null,
        turnLifecycle: 'idle',
      },
      lastUpdatedAt: '2026-04-09T12:34:56.000Z',
    },
    conversation: {
      messages,
    },
    stream: {
      url: `/api/v2/chat/events?slotId=${slotId || ''}&threadId=thread-ready`,
    },
    preferences: {
      model: 'gpt-5.4',
      reasoningEffort: 'medium',
      approvalPolicy: 'never',
      sandboxMode: 'danger-full-access',
    },
    options: {
      models: [
        {
          value: 'gpt-5.4',
          label: 'GPT-5.4',
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
  http.get('/api/v2/thread/history', () => HttpResponse.json({ data: [] })),
  http.get('/api/v2/workspace/files', ({ request }) => {
    const url = new URL(request.url);
    const path = url.searchParams.get('path') || '';

    if (path === '') {
      return HttpResponse.json({
        data: [
          {
            path: 'docs',
            name: 'docs',
            kind: 'directory',
            size: 0,
            ext: '',
            isTextEditable: false,
          },
          {
            path: 'settings.json',
            name: 'settings.json',
            kind: 'file',
            size: 16,
            ext: '.json',
            isTextEditable: true,
          },
          {
            path: 'big.txt',
            name: 'big.txt',
            kind: 'file',
            size: 300000,
            ext: '.txt',
            isTextEditable: true,
          },
          {
            path: 'logo.svg',
            name: 'logo.svg',
            kind: 'file',
            size: 512,
            ext: '.svg',
            isTextEditable: false,
          },
        ],
      });
    }

    if (path === 'docs') {
      return HttpResponse.json({
        data: [
          {
            path: 'docs/guide.md',
            name: 'guide.md',
            kind: 'file',
            size: 8,
            ext: '.md',
            isTextEditable: true,
          },
        ],
      });
    }

    return new HttpResponse('not_found', { status: 404 });
  }),
  http.get('/api/v2/workspace/file', ({ request }) => {
    const url = new URL(request.url);
    const path = url.searchParams.get('path') || '';

    if (path === 'settings.json') {
      return HttpResponse.json({
        path: 'settings.json',
        name: 'settings.json',
        size: 16,
        encoding: 'utf-8',
        content: '{"ok": true}\n',
        isTextEditable: true,
        tooLarge: false,
      });
    }

    if (path === 'big.txt') {
      return HttpResponse.json({
        path: 'big.txt',
        name: 'big.txt',
        size: 300000,
        encoding: 'utf-8',
        content: '',
        isTextEditable: true,
        tooLarge: true,
      });
    }

    if (path === 'logo.svg') {
      return new HttpResponse('not_text_editable', { status: 415 });
    }

    return new HttpResponse('not_found', { status: 404 });
  }),
  http.post('/api/v2/workspace/file', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    saveRequestBodies.push(body);
    return HttpResponse.json({
      ok: true,
      path: body.path,
      size: typeof body.content === 'string' ? body.content.length : 0,
      updatedAt: '2026-04-09T13:00:00.000Z',
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
  window.sessionStorage.clear();
  window.localStorage.clear();
  MockEventSource.reset();
  saveRequestBodies.length = 0;
});

afterAll(() => server.close());

describe('ChatRuntime workspace file explorer flow', () => {
  it('keeps the explorer visible and shows an error when the initial folder load fails', async () => {
    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-ready');
    window.history.replaceState({}, '', `/?slot=${'tab-ready'}`);

    server.use(
      http.get('/api/v2/workspace/files', () =>
        new HttpResponse('workspace/list failed', {
          status: 502,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        }),
      ),
    );

    render(<App />);

    await waitFor(() => expect(screen.getByText('Session synced')).toBeInTheDocument());

    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Toggle tools sidebar' }));
    await user.click(screen.getByRole('button', { name: 'File Explorer' }));

    await waitFor(() => expect(screen.getByRole('region', { name: 'File Explorer' })).toBeInTheDocument());
    expect(screen.getByText('workspace/list failed')).toBeInTheDocument();
    expect(
      within(screen.getByRole('log', { name: 'chat transcript' })).queryByText('workspace/list failed'),
    ).toBeNull();
  });

  it('opens the explorer into a browse-first flow and loads file detail as a preview-first surface', async () => {
    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-ready');
    window.history.replaceState({}, '', `/?slot=${'tab-ready'}`);

    render(<App />);

    await waitFor(() => expect(screen.getByText('Session synced')).toBeInTheDocument());

    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Toggle tools sidebar' }));
    await user.click(screen.getByRole('button', { name: 'File Explorer' }));

    await waitFor(() => expect(screen.getByRole('region', { name: 'File Explorer' })).toBeInTheDocument());
    expect(screen.getByRole('navigation', { name: 'File path' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'File content' })).toBeNull();
    await waitFor(() => expect(screen.getByRole('button', { name: /settings\.json/i })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /settings\.json/i }));

    await waitFor(() => {
      expect(screen.getByText(/utf-8/i)).toBeInTheDocument();
      expect(screen.getByText(/Editable/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'File content' })).toBeNull();
    expect(saveRequestBodies).toHaveLength(0);
  });

  it('navigates into a directory from the explorer entry list with breadcrumb updates', async () => {
    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-ready');
    window.history.replaceState({}, '', `/?slot=${'tab-ready'}`);

    render(<App />);

    await waitFor(() => expect(screen.getByText('Session synced')).toBeInTheDocument());

    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Toggle tools sidebar' }));
    await user.click(screen.getByRole('button', { name: 'File Explorer' }));

    await waitFor(() => expect(screen.getByRole('region', { name: 'File Explorer' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /docs/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'docs' })).toBeInTheDocument());
    expect(screen.getByRole('navigation', { name: 'File path' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guide\.md/i })).toBeInTheDocument();
  });

  it('enters edit mode from preview, saves changes, and keeps the explorer in the redesigned flow', async () => {
    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-ready');
    window.history.replaceState({}, '', `/?slot=${'tab-ready'}`);

    render(<App />);

    await waitFor(() => expect(screen.getByText('Session synced')).toBeInTheDocument());

    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Toggle tools sidebar' }));
    await user.click(screen.getByRole('button', { name: 'File Explorer' }));

    await waitFor(() => expect(screen.getByRole('button', { name: /settings\.json/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /settings\.json/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /edit/i }));

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'File content' })).toHaveValue('{"ok": true}\n');
    });

    fireEvent.change(screen.getByRole('textbox', { name: 'File content' }), {
      target: { value: '{"ok":false}\n' },
    });

    expect(screen.getByText(/unsaved/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Save/i }));

    await waitFor(() => expect(saveRequestBodies).toHaveLength(1));
    expect(saveRequestBodies[0]).toEqual({
      workspace: 'D:/workspace/example-app',
      path: 'settings.json',
      content: '{"ok":false}\n',
    });
    await waitFor(() => expect(screen.getByText('Saved settings.json')).toBeInTheDocument());
  });

  it('shows a dedicated too-large state when a large file is opened from the explorer list', async () => {
    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-ready');
    window.history.replaceState({}, '', `/?slot=${'tab-ready'}`);

    render(<App />);

    await waitFor(() => expect(screen.getByText('Session synced')).toBeInTheDocument());

    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Toggle tools sidebar' }));
    await user.click(screen.getByRole('button', { name: 'File Explorer' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /big\.txt/i })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /big\.txt/i }));

    await waitFor(() => expect(screen.getByText(/too large/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /back to files/i })).toBeInTheDocument();
    expect(screen.queryByText(/showing its folder instead/i)).toBeNull();
  });

  it('shows a dedicated read-only state when an unsupported file is opened from the explorer list', async () => {
    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-ready');
    window.history.replaceState({}, '', `/?slot=${'tab-ready'}`);

    render(<App />);

    await waitFor(() => expect(screen.getByText('Session synced')).toBeInTheDocument());

    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Toggle tools sidebar' }));
    await user.click(screen.getByRole('button', { name: 'File Explorer' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /logo\.svg/i })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /logo\.svg/i }));

    await waitFor(() => expect(screen.getByText(/view-only/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /back to files/i })).toBeInTheDocument();
    expect(screen.queryByText(/showing its folder instead/i)).toBeNull();
  });
});
