import { describe, expect, it } from 'vitest';

import { bootstrapPayload } from './test/chatRuntimeReducerHarness';
import { chatRuntimeReducer } from './state/chat-runtime-reducer';
import { createInitialChatRuntimeState } from './state/chat-runtime-state';

describe('chatRuntimeReducer transcript send state', () => {
  it('adds the accepted user message to the transcript once the backend establishes the turn', () => {
    const hydrated = chatRuntimeReducer(createInitialChatRuntimeState(), {
      type: 'bootstrap/succeeded',
      payload: {
        ...bootstrapPayload,
        session: {
          ...bootstrapPayload.session,
          threadId: '',
          latestTurn: null,
        },
        conversation: {
          messages: [],
        },
        stream: { url: '' },
      },
    });

    const next = chatRuntimeReducer(hydrated, {
      type: 'send/succeeded',
      acceptedText: 'Explain this bug',
      payload: {
        threadId: 'thread-2',
        turn: {
        id: 'turn-2',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
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
    expect(next.latestTurn?.id).toBe('turn-2');
    expect(next.streamUrl).toBe('/api/v2/chat/events?slotId=tab-9&threadId=thread-2');
    expect(next.latestTurn?.status).toBe('running');
  });
});

