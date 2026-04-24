import { describe, expect, it } from 'vitest';

import {
  HttpResponse,
  MockEventSource,
  http,
  registerChatRuntimeTestEnvironment,
  renderApp as render,
  screen,
  sessionGateServer as server,
  setDocumentVisibility,
  userEvent,
  waitFor,
} from './test/chatRuntimeTestHarness';

registerChatRuntimeTestEnvironment();

function createPlanSessionPayload({
  viewerId,
  slotId,
  threadId,
  turnId,
  status,
  messages = [],
}: {
  viewerId: string | null;
  slotId: string | null;
  threadId: string;
  turnId: string;
  status: 'inProgress' | 'completed';
  messages?: Array<Record<string, unknown>>;
}) {
  return HttpResponse.json({
    server: { ok: true, serverInstanceId: 'gate-test', authRequired: false },
    viewer: { viewerId, slotId },
    session: {
      workspace: 'D:/workspace/example-app',
      threadId,
      latestTurn: {
        id: turnId,
        status,
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
      collaborationModeKind: 'plan',
      lastUpdatedAt: '2026-04-03T12:34:56.000Z',
    },
    conversation: {
      messages,
    },
    stream: {
      url: `/api/v2/chat/events?slotId=${slotId}&threadId=${threadId}`,
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
      collaborationModes: [
        { kind: 'plan', label: 'Plan', model: null, reasoningEffort: 'medium' },
        { kind: 'default', label: 'Default', model: null, reasoningEffort: null },
      ],
    },
  });
}

function emitCompletedPlan(threadId: string, turnId: string, planId = 'plan-1') {
  MockEventSource.instances.at(-1)?.emit('timeline_item_updated', {
    threadId,
    turnId,
    item: {
      id: planId,
      kind: 'special',
      itemType: 'plan',
      text: 'Inspect the failing tests',
      state: 'complete',
      threadId,
      turnId,
      raw: {
        type: 'plan',
        id: planId,
        text: 'Inspect the failing tests',
      },
    },
  });
  MockEventSource.instances.at(-1)?.emit('turn_completed', {
    threadId,
    turn: {
      id: turnId,
      status: 'completed',
      error: null,
      startedAt: null,
      completedAt: null,
      durationMs: null,
    },
  });
}

describe('ChatRuntime plan actions', () => {
  it('shows an inline proposed-plan action and auto-sends implementation in default mode', async () => {
    const sendBodies: Array<Record<string, unknown>> = [];

    server.use(
      http.get('/api/v2/session', ({ request }) =>
        createPlanSessionPayload({
          viewerId: new URL(request.url).searchParams.get('viewerId'),
          slotId: new URL(request.url).searchParams.get('slotId'),
          threadId: 'thread-plan',
          turnId: 'turn-ready',
          status: 'inProgress',
        })),
      http.post('/api/v2/chat/message', async ({ request }) => {
        sendBodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({
          threadId: 'thread-plan',
          turn: {
            id: `turn-${sendBodies.length}`,
            status: 'inProgress',
            error: null,
            startedAt: null,
            completedAt: null,
            durationMs: null,
          },
          stream: {
            url: '/api/v2/chat/events?slotId=tab-plan&threadId=thread-plan',
          },
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-plan');
    window.history.replaceState({}, '', `/?slot=${'tab-plan'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-plan');

    const user = userEvent.setup();
    render();

    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
    emitCompletedPlan('thread-plan', 'turn-ready');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Implement plan' })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Implement plan' }));

    await waitFor(() => expect(sendBodies).toHaveLength(1));
    expect(sendBodies[0]).toEqual({
      viewerId: 'viewer-plan',
      slotId: expect.stringMatching(/^(slot|tab)-/),
      workspace: 'D:/workspace/example-app',
      threadId: 'thread-plan',
      text: 'Implement the plan.',
      runtimeSettings: {
        model: 'gpt-5.1-codex',
        reasoningEffort: 'medium',
        approvalPolicy: 'never',
        sandboxMode: 'danger-full-access',
        collaborationModeKind: 'default',
      },
    });
    await waitFor(() => expect(screen.getByText('Plan implementation requested')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Implement plan' })).not.toBeInTheDocument();
  });

  it('keeps plan mode selected when the inline proposed-plan action fails so the user can retry', async () => {
    server.use(
      http.get('/api/v2/session', ({ request }) =>
        createPlanSessionPayload({
          viewerId: new URL(request.url).searchParams.get('viewerId'),
          slotId: new URL(request.url).searchParams.get('slotId'),
          threadId: 'thread-plan-failure',
          turnId: 'turn-ready',
          status: 'inProgress',
        })),
      http.post('/api/v2/chat/message', () =>
        new HttpResponse('failed to start implementation turn', {
          status: 502,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-plan-failure');
    window.history.replaceState({}, '', `/?slot=${'tab-plan-failure'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-plan-failure');

    const user = userEvent.setup();
    render();

    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
    emitCompletedPlan('thread-plan-failure', 'turn-ready', 'plan-failure-1');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Implement plan' })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Implement plan' }));

    await waitFor(() => expect(screen.getByText('failed to start implementation turn')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Implement plan' })).toBeInTheDocument();
    expect(
      JSON.parse(window.localStorage.getItem('my-code-x-slot:tab-plan-failure:runtime-preferences') || '{}'),
    ).toMatchObject({
      collaborationModeKind: 'plan',
    });
  });

  it('keeps a resolved inline action card when the user stays in Plan mode', async () => {
    server.use(
      http.get('/api/v2/session', ({ request }) =>
        createPlanSessionPayload({
          viewerId: new URL(request.url).searchParams.get('viewerId'),
          slotId: new URL(request.url).searchParams.get('slotId'),
          threadId: 'thread-plan-stay',
          turnId: 'turn-stay',
          status: 'inProgress',
        })),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-plan-stay');
    window.history.replaceState({}, '', `/?slot=${'tab-plan-stay'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-plan-stay');

    const user = userEvent.setup();
    render();

    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
    emitCompletedPlan('thread-plan-stay', 'turn-stay', 'plan-stay-1');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Stay in Plan mode' })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Stay in Plan mode' }));

    await waitFor(() => expect(screen.getByText('Stayed in Plan mode')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Stay in Plan mode' })).not.toBeInTheDocument();
  });

  it('re-renders the inline proposed-plan action after visibility re-bootstrap replaces local state', async () => {
    let requestCount = 0;

    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        requestCount += 1;

        if (requestCount === 1) {
          return createPlanSessionPayload({
            viewerId: url.searchParams.get('viewerId'),
            slotId: url.searchParams.get('slotId'),
            threadId: 'thread-plan-return',
            turnId: 'turn-plan-return',
            status: 'inProgress',
          });
        }

        return createPlanSessionPayload({
          viewerId: url.searchParams.get('viewerId'),
          slotId: url.searchParams.get('slotId'),
          threadId: 'thread-plan-return',
          turnId: 'turn-plan-return',
          status: 'completed',
          messages: [
            {
              id: 'user:turn-plan-return',
              kind: 'message',
              itemType: 'userMessage',
              role: 'user',
              text: 'draft a plan',
              state: 'complete',
              threadId: 'thread-plan-return',
              turnId: 'turn-plan-return',
            },
            {
              id: 'plan:return',
              kind: 'special',
              itemType: 'plan',
              text: 'Inspect the failing tests',
              state: 'complete',
              threadId: 'thread-plan-return',
              turnId: 'turn-plan-return',
              raw: {
                type: 'plan',
                id: 'plan:return',
                text: 'Inspect the failing tests',
              },
            },
            {
              id: 'assistant:turn-plan-return',
              kind: 'message',
              itemType: 'agentMessage',
              role: 'assistant',
              text: 'Here is the plan.',
              state: 'complete',
              threadId: 'thread-plan-return',
              turnId: 'turn-plan-return',
            },
          ],
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-plan-return');
    window.history.replaceState({}, '', `/?slot=${'tab-plan-return'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-plan-return');

    render();

    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
    emitCompletedPlan('thread-plan-return', 'turn-plan-return', 'plan:return');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Implement plan' })).toBeInTheDocument());

    setDocumentVisibility('hidden');
    await waitFor(() => expect(MockEventSource.instances[0]?.closed).toBe(true));

    setDocumentVisibility('visible');

    await waitFor(() => expect(screen.getByText('Here is the plan.')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Implement plan' })).toBeInTheDocument());
    expect(requestCount).toBe(2);
  });
});
