import { describe, expect, it } from 'vitest';

import { bootstrapPayload } from './test/sessionReducerHarness';
import { sessionReducer } from './state/session-reducer';
import { createInitialSessionState } from './state/session-state';

describe('sessionReducer transcript send state', () => {
  it('adds the accepted user message to the transcript once the backend establishes the turn', () => {
    const hydrated = sessionReducer(createInitialSessionState(), {
      type: 'bootstrap/succeeded',
      payload: {
        ...bootstrapPayload,
        session: {
          ...bootstrapPayload.session,
          threadId: '',
          turnExecution: {
            activeTurnId: null,
            turnLifecycle: 'idle',
          },
        },
        conversation: {
          messages: [],
        },
        stream: { url: '' },
      },
    });

    const next = sessionReducer(hydrated, {
      type: 'send/succeeded',
      acceptedText: 'Explain this bug',
      payload: {
        threadId: 'thread-2',
        turnExecution: {
          activeTurnId: 'turn-2',
          turnLifecycle: 'running',
        },
        stream: {
          url: '/api/v2/chat/events?slotId=tab-9&threadId=thread-2',
        },
      },
    });

    expect(next.messages).toEqual([
      {
        id: 'user:turn-2',
        kind: 'message',
        itemType: 'userMessage',
        role: 'user',
        text: 'Explain this bug',
        state: 'complete',
        threadId: 'thread-2',
        turnId: 'turn-2',
      },
    ]);
    expect(next.threadId).toBe('thread-2');
    expect(next.turnExecution.activeTurnId).toBe('turn-2');
    expect(next.streamUrl).toBe('/api/v2/chat/events?slotId=tab-9&threadId=thread-2');
    expect(next.turnExecution.turnLifecycle).toBe('running');
  });
});

