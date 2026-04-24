import { describe, expect, it } from 'vitest';

import {
  HttpResponse,
  createSessionResponse,
  http,
  openRuntimeSettings,
  registerChatRuntimeTestEnvironment,
  renderApp as render,
  screen,
  sessionGateServer as server,
  setTextboxValue,
  userEvent,
  waitFor,
} from './test/chatRuntimeTestHarness';

registerChatRuntimeTestEnvironment();

describe('ChatRuntime collaboration mode send', () => {
  it('sends the selected collaboration mode with the next user message', async () => {
    const sendBodies: Array<Record<string, unknown>> = [];

    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        return createSessionResponse({
          viewerId: url.searchParams.get('viewerId'),
          slotId: url.searchParams.get('slotId'),
          threadId: 'thread-mode',
          messages: [],
        });
      }),
      http.post('/api/v2/chat/message', async ({ request }) => {
        sendBodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({
          threadId: 'thread-mode',
          turnId: 'turn-mode',
          status: 'inProgress',
          stream: {
            url: '/api/v2/chat/events?slotId=tab-mode&threadId=thread-mode',
          },
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-mode');
    window.history.replaceState({}, '', `/?slot=${'tab-mode'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-mode');

    const user = userEvent.setup();
    render();

    await waitFor(() => expect(screen.getByText('Session synced')).toBeInTheDocument());

    await openRuntimeSettings(user);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Mode' }), 'plan');
    setTextboxValue('chat input', 'draft a plan');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(sendBodies).toHaveLength(1));
    expect(sendBodies[0]).toEqual({
      viewerId: 'viewer-mode',
      slotId: expect.stringMatching(/^(slot|tab)-/),
      workspace: 'D:/workspace/example-app',
      threadId: 'thread-mode',
      content: [{ type: 'text', text: 'draft a plan' }],
      runtimeSettings: {
        model: 'gpt-5.1-codex',
        reasoningEffort: 'medium',
        approvalPolicy: 'never',
        sandboxMode: 'danger-full-access',
        collaborationModeKind: 'plan',
      },
    });
  });

  it('does not send collaboration mode when mode is set to none', async () => {
    let sendBody: Record<string, unknown> | null = null;

    server.use(
      http.post('/api/v2/chat/message', async ({ request }) => {
        sendBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          threadId: 'thread-none',
          turnId: 'turn-none',
          status: 'inProgress',
          stream: {
            url: '/api/v2/chat/events?slotId=tab-none&threadId=thread-none',
          },
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-none');
    window.history.replaceState({}, '', `/?slot=${'tab-none'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-ready');

    const user = userEvent.setup();
    render();

    await waitFor(() => expect(screen.getByText('Session synced')).toBeInTheDocument());

    await openRuntimeSettings(user);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Mode' }), '');
    setTextboxValue('chat input', 'send without mode');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(sendBody).not.toBeNull());
    expect(sendBody).toEqual({
      viewerId: 'viewer-none',
      slotId: expect.stringMatching(/^(slot|tab)-/),
      workspace: 'D:/workspace/example-app',
      threadId: 'thread-ready',
      content: [{ type: 'text', text: 'send without mode' }],
      runtimeSettings: {
        model: 'gpt-5.1-codex',
        reasoningEffort: 'medium',
        approvalPolicy: 'never',
        sandboxMode: 'danger-full-access',
      },
    });
  });
});
