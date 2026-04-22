import { describe, expect, it } from 'vitest';

import {
  HttpResponse,
  MockEventSource,
  createSessionResponse,
  http,
  registerSessionGateTestLifecycle,
  renderApp as render,
  screen,
  sessionGateServer as server,
  setTextboxValue,
  userEvent,
  waitFor,
} from './test/sessionGateTestHarness';
import { within } from '@testing-library/react';

registerSessionGateTestLifecycle();

describe('SessionGate transcript turn continuity', () => {
  it('does not render the new user message before the backend accepts the send', async () => {
    let resolveSend: ((response: Response) => void) | null = null;
    const sendResponse = new Promise<Response>(resolve => {
      resolveSend = resolve;
    });

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
      http.post('/api/v2/chat/message', () => sendResponse),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-turn-gated');
    window.history.replaceState({}, '', `/?slot=${'tab-turn-gated'}`);

    const user = userEvent.setup();
    render();

    await waitFor(() => expect(screen.getByText('Session synced')).toBeInTheDocument());

    setTextboxValue('chat input', 'Explain this bug');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    const transcriptLog = screen.getByRole('log', { name: 'chat transcript' });
    expect(within(transcriptLog).queryByText('Explain this bug')).toBeNull();

    if (!resolveSend) {
      throw new Error('Expected send resolver to be available.');
    }
    const completeSend = resolveSend as (response: Response) => void;

    completeSend(
      HttpResponse.json({
        threadId: 'thread-turn-gated',
        turnExecution: {
          activeTurnId: 'turn-turn-gated',
          turnLifecycle: 'running',
        },
        stream: {
          url: '/api/v2/chat/events?slotId=tab-turn-gated&threadId=thread-turn-gated',
        },
      }),
    );
  });

  it('renders the accepted user message once after the backend establishes the turn', async () => {
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
      http.post('/api/v2/chat/message', () =>
        HttpResponse.json({
          threadId: 'thread-turn-visible',
          turnExecution: {
            activeTurnId: 'turn-turn-visible',
            turnLifecycle: 'running',
          },
          stream: {
            url: '/api/v2/chat/events?slotId=tab-turn-visible&threadId=thread-turn-visible',
          },
        })),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-turn-visible');
    window.history.replaceState({}, '', `/?slot=${'tab-turn-visible'}`);

    const user = userEvent.setup();
    render();

    await waitFor(() => expect(screen.getByText('Session synced')).toBeInTheDocument());

    setTextboxValue('chat input', 'Explain this bug');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(window.localStorage.getItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`)).toBe('thread-turn-visible'));
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
    const transcriptLog = screen.getByRole('log', { name: 'chat transcript' });
    await waitFor(() => expect(within(transcriptLog).getAllByText('Explain this bug')).toHaveLength(1));
  });
});
