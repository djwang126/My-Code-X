import { within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  HttpResponse,
  MockEventSource,
  createAssistantMessage,
  createUserMessage,
  http,
  registerSessionGateTestLifecycle,
  renderApp as render,
  screen,
  sessionGateServer as server,
  waitFor,
} from './test/sessionGateTestHarness';

registerSessionGateTestLifecycle();

function createTurnLevelError(message: string) {
  return {
    message,
    codexErrorInfo: 'other',
    additionalDetails: null,
    httpStatusCode: null,
    willRetry: false,
    threadId: 'thread-turn-ordering',
    turnId: 'turn-turn-ordering',
    presentationScope: 'conversation',
    source: 'error_notification',
    raw: { message },
  };
}

function expectAfter(previous: HTMLElement, next: HTMLElement) {
  expect(previous.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
}

describe('SessionGate transcript turn failure ordering', () => {
  it('appends an accepted turn failure after the last existing item from that turn', async () => {
    server.use(
      http.get('/api/v2/session', ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          server: { ok: true, serverInstanceId: 'gate-test', authRequired: false },
          viewer: { viewerId: url.searchParams.get('viewerId'), slotId: url.searchParams.get('slotId') },
          session: {
            workspace: 'D:/workspace/example-app',
            threadId: 'thread-turn-ordering',
            turnExecution: {
              activeTurnId: 'turn-turn-ordering',
              turnLifecycle: 'running',
            },
            lastUpdatedAt: '2026-04-03T12:34:56.000Z',
          },
          conversation: {
            messages: [
              createUserMessage(
                'user:turn-turn-ordering',
                'Explain this bug',
                'thread-turn-ordering',
                'turn-turn-ordering',
              ),
              createAssistantMessage(
                'assistant:turn-turn-ordering',
                'Still checking the logs',
                'thread-turn-ordering',
                'turn-turn-ordering',
              ),
            ],
          },
          stream: {
            url: '/api/v2/chat/events?slotId=tab-turn-ordering&threadId=thread-turn-ordering',
          },
          preferences: {},
          options: {},
        });
      }),
    );

    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-turn-ordering');
    window.history.replaceState({}, '', `/?slot=${'tab-turn-ordering'}`);
    window.localStorage.setItem(`my-code-x-slot:${new URL(window.location.href).searchParams.get('slot')}:thread-id`, 'thread-turn-ordering');

    render();

    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));

    MockEventSource.instances[0]?.emit('timeline_item_updated', {
      threadId: 'thread-turn-ordering',
      turnId: 'turn-turn-ordering',
      item: {
        id: 'plan-turn-ordering',
        kind: 'special',
        itemType: 'plan',
        text: 'Check the failing API call',
        state: 'complete',
        threadId: 'thread-turn-ordering',
        turnId: 'turn-turn-ordering',
        raw: {
          type: 'plan',
          id: 'plan-turn-ordering',
          text: 'Check the failing API call',
        },
      },
    });

    MockEventSource.instances[0]?.emit('turn_completed', {
      threadId: 'thread-turn-ordering',
      turnExecution: {
        activeTurnId: 'turn-turn-ordering',
        turnLifecycle: 'failed',
      },
      error: createTurnLevelError('Upstream failed after the plan step'),
    });

    const transcriptLog = screen.getByRole('log', { name: 'chat transcript' });

    const assistantMessage = await within(transcriptLog).findByText('Still checking the logs');
    const planItem = await within(transcriptLog).findByText('Check the failing API call');
    const failureMessage = await within(transcriptLog).findByText('Upstream failed after the plan step');

    expectAfter(assistantMessage, planItem);
    expectAfter(planItem, failureMessage);
  });
});
