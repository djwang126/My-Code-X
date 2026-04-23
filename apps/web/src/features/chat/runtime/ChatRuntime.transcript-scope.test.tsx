import { within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  HttpResponse,
  http,
  MockEventSource,
  registerChatRuntimeTestLifecycle,
  renderApp as render,
  screen,
  sessionGateServer as server,
  userEvent,
  waitFor,
} from './test/chatRuntimeTestHarness';

registerChatRuntimeTestLifecycle();

function setSessionIdentity(viewerId: string, slotId: string, threadId = 'thread-ready') {
  window.sessionStorage.setItem('my-code-x-viewer-id', viewerId);
  window.history.replaceState({}, '', `/?slot=${slotId}`);
  window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, threadId);
}

async function openFileExplorer(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Toggle tools sidebar' }));
  await user.click(screen.getByRole('button', { name: 'File Explorer' }));
  return screen.findByRole('region', { name: 'File Explorer' });
}

describe('ChatRuntime transcript error scope', () => {
  it('does not render the chat transcript while bootstrap is auth-required', async () => {
    setSessionIdentity('viewer-auth', 'tab-auth');

    render();

    await waitFor(() => expect(screen.getByText('Access token required')).toBeInTheDocument());
    expect(screen.queryByRole('log', { name: 'chat transcript' })).toBeNull();
  });

  it('does not render the chat transcript while bootstrap is blocked by a restore failure', async () => {
    server.use(
      http.get('/api/v2/session', () =>
        new HttpResponse('no rollout found for thread id thread-missing', {
          status: 502,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })),
    );

    setSessionIdentity('viewer-bootstrap-failure', 'tab-bootstrap-failure');

    render();

    await waitFor(() =>
      expect(screen.getByText('no rollout found for thread id thread-missing')).toBeInTheDocument(),
    );
    expect(screen.queryByRole('log', { name: 'chat transcript' })).toBeNull();
  });

  it('keeps workspace threads load failures out of the transcript log and scopes them to the workspace sidebar', async () => {
    server.use(
      http.get('/api/v2/thread/history', () =>
        new HttpResponse('history backend failed', {
          status: 502,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })),
    );

    setSessionIdentity('viewer-workspace-threads-error', 'tab-workspace-threads-error');

    const user = userEvent.setup();
    render();

    const transcriptSection = await screen.findByLabelText('chat transcript section');
    const transcriptLog = screen.getByRole('log', { name: 'chat transcript' });
    expect(within(transcriptLog).queryByText('Failed to load workspace threads.')).toBeNull();
    expect(within(transcriptSection).queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('alert', { name: 'Chat page feedback' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Toggle workspace sidebar' }));
    expect(
      within(screen.getByRole('region', { name: 'workspace threads' })).getByText('history backend failed'),
    ).toBeInTheDocument();
  });

  it('renders live session notices in the toast region instead of the transcript log', async () => {
    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          server: { ok: true, serverInstanceId: 'gate-test', authRequired: false },
          viewer: { viewerId: url.searchParams.get('viewerId'), slotId: url.searchParams.get('slotId') },
          session: {
            workspace: 'D:/workspace/example-app',
            threadId: 'thread-ready',
            turnExecution: {
              activeTurnId: 'turn-ready',
              turnLifecycle: 'running',
            },
            lastUpdatedAt: '2026-04-03T12:34:56.000Z',
          },
          conversation: {
            messages: [],
          },
          stream: {
            url: '/api/v2/chat/events?slotId=tab-live-notice&threadId=thread-ready',
          },
          preferences: {},
          options: {},
        });
      }),
    );

    setSessionIdentity('viewer-live-notice', 'tab-live-notice');

    render();

    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    MockEventSource.instances[0]?.emit('system_notice', {
      threadId: 'thread-ready',
      notice: {
        id: 'configWarning:latest',
        level: 'warning',
        title: 'Config warning',
        text: 'Sandbox will be tightened soon',
      },
    });

    const transcriptLog = screen.getByRole('log', { name: 'chat transcript' });
    const toastRegion = await screen.findByRole('region', { name: 'Chat toasts' });

    expect(toastRegion).toHaveTextContent('Config warning');
    expect(toastRegion).toHaveTextContent('Sandbox will be tightened soon');
    expect(within(transcriptLog).queryByText('Config warning')).toBeNull();
    expect(within(transcriptLog).queryByText('Sandbox will be tightened soon')).toBeNull();
  });

  it('keeps workspace explorer load failures out of the transcript and inside the explorer panel', async () => {
    server.use(
      http.get('/api/v2/workspace/files', () =>
        new HttpResponse('workspace explorer backend failed', {
          status: 502,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })),
    );

    setSessionIdentity('viewer-workspace-explorer-error', 'tab-workspace-explorer-error');

    const user = userEvent.setup();
    render();

    await waitFor(() => expect(screen.getByText('Session synced')).toBeInTheDocument());

    const transcriptSection = screen.getByLabelText('chat transcript section');
    const transcriptLog = screen.getByRole('log', { name: 'chat transcript' });
    const explorerRegion = await openFileExplorer(user);
    const explorerAlert = await within(explorerRegion).findByRole('alert');

    expect(explorerAlert).toHaveTextContent('workspace explorer backend failed');
    expect(within(transcriptLog).queryByText('workspace explorer backend failed')).toBeNull();
    expect(within(transcriptSection).queryByRole('alert')).toBeNull();
  });

  it('keeps workspace file save failures out of the transcript and scoped to the explorer panel', async () => {
    server.use(
      http.get('/api/v2/workspace/files', () =>
        HttpResponse.json({
          data: [
            {
              path: 'notes.md',
              name: 'notes.md',
              kind: 'file',
              size: 12,
              ext: '.md',
              contentKind: 'text',
              isLarge: false,
            },
          ],
        })),
      http.get('/api/v2/workspace/file', () =>
        HttpResponse.json({
          kind: 'text',
          path: 'notes.md',
          name: 'notes.md',
          size: 12,
          encoding: 'utf-8',
          content: '# notes\n',
          truncated: false,
        })),
      http.post('/api/v2/workspace/file', () =>
        new HttpResponse('workspace save failed', {
          status: 502,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })),
    );

    setSessionIdentity('viewer-workspace-save-error', 'tab-workspace-save-error');

    const user = userEvent.setup();
    render();

    await waitFor(() => expect(screen.getByText('Session synced')).toBeInTheDocument());

    const transcriptSection = screen.getByLabelText('chat transcript section');
    const transcriptLog = screen.getByRole('log', { name: 'chat transcript' });
    const explorerRegion = await openFileExplorer(user);

    await user.click(await within(explorerRegion).findByRole('button', { name: 'notes.md' }));
    await user.click(await within(explorerRegion).findByRole('button', { name: 'Edit' }));
    await user.clear(within(explorerRegion).getByRole('textbox', { name: 'File content' }));
    await user.type(within(explorerRegion).getByRole('textbox', { name: 'File content' }), '# changed');
    await user.click(within(explorerRegion).getByRole('button', { name: /save/i }));

    const explorerAlert = await within(explorerRegion).findByRole('alert');

    expect(explorerAlert).toHaveTextContent('workspace save failed');
    expect(within(transcriptLog).queryByText('workspace save failed')).toBeNull();
    expect(within(transcriptSection).queryByRole('alert')).toBeNull();
  });
});
