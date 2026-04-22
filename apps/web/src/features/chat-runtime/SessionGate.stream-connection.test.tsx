import { describe, expect, it } from 'vitest';
import { act } from '@testing-library/react';

import {
  dispatchSlotOwnershipChange,
  HttpResponse,
  MockEventSource,
  createAssistantMessage,
  createUserMessage,
  http,
  registerSessionGateTestLifecycle,
  renderApp as render,
  screen,
  sessionGateServer as server,
  setDocumentVisibility,
  waitFor,
} from './test/sessionGateTestHarness';
import { getPageOwnerInstanceId, SLOT_DISPLACED_MESSAGE } from '../session';

registerSessionGateTestLifecycle();

describe('SessionGate stream connection', () => {
  it('reconnects the event stream on visibility return when the turn is still in progress', async () => {
    let requestCount = 0;

    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        requestCount += 1;
        return HttpResponse.json({
          server: { ok: true, serverInstanceId: 'gate-test', authRequired: false },
          viewer: { viewerId: url.searchParams.get('viewerId'), slotId: url.searchParams.get('slotId') },
          session: {
            workspace: 'D:/workspace/example-app',
            threadId: 'thread-reconnect',
            turnExecution: {
              activeTurnId: 'turn-reconnect',
              turnLifecycle: 'running',
            },
            lastUpdatedAt: '2026-04-03T12:34:56.000Z',
          },
          conversation: {
            messages: [
              createUserMessage('user:turn-reconnect', 'status?', 'thread-reconnect', 'turn-reconnect'),
              createAssistantMessage(
                'assistant:turn-reconnect',
                requestCount === 1 ? 'first partial' : 'second partial',
                'thread-reconnect',
                'turn-reconnect',
                'streaming',
              ),
            ],
          },
          stream: {
            url: '/api/v2/chat/events?slotId=tab-reconnect&threadId=thread-reconnect',
          },
          preferences: {},
          options: {},
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-reconnect');
    window.history.replaceState({}, '', `/?slot=${'tab-reconnect'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-reconnect');

    render();

    await waitFor(() => expect(screen.getByText('first partial')).toBeInTheDocument());
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    const firstStream = MockEventSource.instances[0];

    setDocumentVisibility('hidden');

    await waitFor(() => expect(firstStream?.closed).toBe(true));

    setDocumentVisibility('visible');

    await waitFor(() => expect(MockEventSource.instances).toHaveLength(2));

    MockEventSource.instances[1]?.emit('snapshot', {
      threadId: 'thread-reconnect',
      activeTurnId: 'turn-reconnect',
      turnLifecycle: 'running',
      messages: [
        createUserMessage('user:turn-reconnect', 'status?', 'thread-reconnect', 'turn-reconnect'),
        createAssistantMessage('assistant:turn-reconnect', 'second partial', 'thread-reconnect', 'turn-reconnect', 'streaming'),
      ],
    });

    await waitFor(() => expect(screen.getByText('second partial')).toBeInTheDocument());
    expect(requestCount).toBeGreaterThanOrEqual(2);
  });

  it('pauses the event stream while the page is hidden', async () => {
    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          server: { ok: true, serverInstanceId: 'gate-test', authRequired: false },
          viewer: { viewerId: url.searchParams.get('viewerId'), slotId: url.searchParams.get('slotId') },
          session: {
            workspace: 'D:/workspace/example-app',
            threadId: 'thread-hidden-pause',
            turnExecution: {
              activeTurnId: 'turn-hidden-pause',
              turnLifecycle: 'running',
            },
            lastUpdatedAt: '2026-04-03T12:34:56.000Z',
          },
          conversation: {
            messages: [
              createUserMessage('user:turn-hidden-pause', 'status?', 'thread-hidden-pause', 'turn-hidden-pause'),
              createAssistantMessage(
                'assistant:turn-hidden-pause',
                'still thinking',
                'thread-hidden-pause',
                'turn-hidden-pause',
                'streaming',
              ),
            ],
          },
          stream: {
            url: '/api/v2/chat/events?slotId=tab-hidden-pause&threadId=thread-hidden-pause',
          },
          preferences: {},
          options: {},
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-hidden-pause');
    window.history.replaceState({}, '', `/?slot=${'tab-hidden-pause'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-hidden-pause');

    render();

    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    const initialStream = MockEventSource.instances[0];

    setDocumentVisibility('hidden');

    await waitFor(() => expect(initialStream?.closed).toBe(true));
    expect(MockEventSource.instances).toHaveLength(1);
  });

  it('closes the current event stream and shows displaced state when another window takes over the slot', async () => {
    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          server: { ok: true, serverInstanceId: 'gate-test', authRequired: false },
          viewer: { viewerId: url.searchParams.get('viewerId'), slotId: url.searchParams.get('slotId') },
          session: {
            workspace: 'D:/workspace/example-app',
            threadId: 'thread-takeover',
            turnExecution: {
              activeTurnId: 'turn-takeover',
              turnLifecycle: 'running',
            },
            lastUpdatedAt: '2026-04-03T12:34:56.000Z',
          },
          conversation: {
            messages: [
              createUserMessage('user:turn-takeover', 'status?', 'thread-takeover', 'turn-takeover'),
              createAssistantMessage(
                'assistant:turn-takeover',
                'still working',
                'thread-takeover',
                'turn-takeover',
                'streaming',
              ),
            ],
          },
          stream: {
            url: '/api/v2/chat/events?slotId=slot-takeover&threadId=thread-takeover',
          },
          preferences: {},
          options: {},
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-takeover');
    window.history.replaceState({}, '', '/?slot=slot-takeover');
    window.localStorage.setItem('my-code-x-slot:slot-takeover:thread-id', 'thread-takeover');

    render();

    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    const activeStream = MockEventSource.instances[0];
    dispatchSlotOwnershipChange({ slotId: 'slot-takeover' });

    await waitFor(() => expect(activeStream?.closed).toBe(true));
    await waitFor(() => expect(screen.getByText(SLOT_DISPLACED_MESSAGE)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Retake slot' })).toBeInTheDocument();
    expect(MockEventSource.instances).toHaveLength(1);
  });

  it('reclaims the slot and reconnects the event stream when the displaced window becomes visible again', async () => {
    let requestCount = 0;

    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        requestCount += 1;
        return HttpResponse.json({
          server: { ok: true, serverInstanceId: 'gate-test', authRequired: false },
          viewer: { viewerId: url.searchParams.get('viewerId'), slotId: url.searchParams.get('slotId') },
          session: {
            workspace: 'D:/workspace/example-app',
            threadId: 'thread-retake',
            turnExecution: {
              activeTurnId: 'turn-retake',
              turnLifecycle: 'running',
            },
            lastUpdatedAt: '2026-04-03T12:34:56.000Z',
          },
          conversation: {
            messages: [
              createUserMessage('user:turn-retake', 'status?', 'thread-retake', 'turn-retake'),
              createAssistantMessage(
                'assistant:turn-retake',
                requestCount === 1 ? 'first partial' : 'reclaimed partial',
                'thread-retake',
                'turn-retake',
                'streaming',
              ),
            ],
          },
          stream: {
            url: '/api/v2/chat/events?slotId=slot-retake&threadId=thread-retake',
          },
          preferences: {},
          options: {},
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-retake');
    window.history.replaceState({}, '', '/?slot=slot-retake');
    window.localStorage.setItem('my-code-x-slot:slot-retake:thread-id', 'thread-retake');

    render();

    await waitFor(() => expect(screen.getByText('first partial')).toBeInTheDocument());
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    const firstStream = MockEventSource.instances[0];
    dispatchSlotOwnershipChange({ slotId: 'slot-retake' });

    await waitFor(() => expect(screen.getByText(SLOT_DISPLACED_MESSAGE)).toBeInTheDocument());
    await waitFor(() => expect(firstStream?.closed).toBe(true));

    setDocumentVisibility('hidden');
    setDocumentVisibility('visible');

    await waitFor(() => expect(MockEventSource.instances).toHaveLength(2));
    await waitFor(() => expect(screen.queryByText(SLOT_DISPLACED_MESSAGE)).not.toBeInTheDocument());
    expect(requestCount).toBeGreaterThanOrEqual(2);

    const ownership = window.localStorage.getItem('my-code-x-slot:slot-retake:ownership');
    expect(ownership).toContain(getPageOwnerInstanceId());

    MockEventSource.instances[1]?.emit('snapshot', {
      threadId: 'thread-retake',
      activeTurnId: 'turn-retake',
      turnLifecycle: 'running',
      messages: [
        createUserMessage('user:turn-retake', 'status?', 'thread-retake', 'turn-retake'),
        createAssistantMessage('assistant:turn-retake', 'reclaimed partial', 'thread-retake', 'turn-retake', 'streaming'),
      ],
    });

    await waitFor(() => expect(screen.getByText('reclaimed partial')).toBeInTheDocument());
  });

  it('ignores a stale bootstrap response after another window takes over the slot', async () => {
    let resolveBootstrap: ((response: Response) => void) | null = null;

    server.use(
      http.get('/api/v2/session', () => {
        return new Promise<Response>(resolve => {
          resolveBootstrap = resolve;
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-stale-bootstrap');
    window.history.replaceState({}, '', '/?slot=slot-stale-bootstrap');

    render();

    await waitFor(() => expect(resolveBootstrap).not.toBeNull());

    dispatchSlotOwnershipChange({ slotId: 'slot-stale-bootstrap' });

    await waitFor(() => expect(screen.getByText(SLOT_DISPLACED_MESSAGE)).toBeInTheDocument());

    await act(async () => {
      resolveBootstrap?.(
        HttpResponse.json({
          server: { ok: true, serverInstanceId: 'gate-test', authRequired: false },
          viewer: { viewerId: 'viewer-stale-bootstrap', slotId: 'slot-stale-bootstrap' },
          session: {
            workspace: 'D:/workspace/example-app',
            threadId: 'thread-stale-bootstrap',
            turnExecution: {
              activeTurnId: 'turn-stale-bootstrap',
              turnLifecycle: 'running',
            },
            lastUpdatedAt: '2026-04-03T12:34:56.000Z',
          },
          conversation: {
            messages: [
              createUserMessage(
                'user:turn-stale-bootstrap',
                'status?',
                'thread-stale-bootstrap',
                'turn-stale-bootstrap',
              ),
              createAssistantMessage(
                'assistant:turn-stale-bootstrap',
                'stale partial',
                'thread-stale-bootstrap',
                'turn-stale-bootstrap',
                'streaming',
              ),
            ],
          },
          stream: {
            url: '/api/v2/chat/events?slotId=slot-stale-bootstrap&threadId=thread-stale-bootstrap',
          },
          preferences: {},
          options: {},
        }),
      );
      await Promise.resolve();
    });
    resolveBootstrap = null;

    await waitFor(() =>
      expect(window.localStorage.getItem('my-code-x-slot:slot-stale-bootstrap:thread-id')).toBeNull(),
    );
    expect(MockEventSource.instances).toHaveLength(0);
    expect(screen.queryByText('stale partial')).not.toBeInTheDocument();
  });

});
