import { within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  HttpResponse,
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

registerSessionGateTestLifecycle();

describe('SessionGate transcript pre-turn failure behavior', () => {
  it('keeps pre-turn send failures outside the transcript and does not insert the unsent user turn', async () => {
    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        return createSessionResponse({
          viewerId: url.searchParams.get('viewerId'),
          slotId: url.searchParams.get('slotId'),
          threadId: 'thread-pre-turn-failure',
          messages: [],
        });
      }),
      http.post('/api/v2/chat/message', () =>
        new HttpResponse('thread mismatch for tab runtime', {
          status: 502,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-pre-turn-failure');
    window.history.replaceState({}, '', `/?slot=${'tab-pre-turn-failure'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-pre-turn-failure');

    const user = userEvent.setup();
    render();

    await waitFor(() => expect(screen.getByText('Session synced')).toBeInTheDocument());

    setTextboxValue('chat input', 'Explain this bug');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('thread mismatch for tab runtime'));

    const transcriptLog = screen.getByRole('log', { name: 'chat transcript' });
    const globalAlert = screen.getByRole('alert');

    expect(within(transcriptLog).queryByText('Explain this bug')).toBeNull();
    expect(within(transcriptLog).queryByText('thread mismatch for tab runtime')).toBeNull();
    expect(transcriptLog).not.toContainElement(globalAlert);
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();
  });
});
