import { describe, expect, it } from 'vitest';

import { bootstrapPayload } from './test/chatRuntimeReducerHarness';
import { chatRuntimeReducer } from './state/chat-runtime-reducer';
import { createInitialChatRuntimeState } from './state/chat-runtime-state';

describe('chatRuntimeReducer transcript user reconciliation', () => {
  it('applies reconciled user message content in place when the server emits a timeline update', () => {
    const hydrated = chatRuntimeReducer(createInitialChatRuntimeState(), {
      type: 'bootstrap/succeeded',
      payload: {
        ...bootstrapPayload,
        session: {
          ...bootstrapPayload.session,
          threadId: 'thread-2',
          latestTurn: {
        id: 'turn-2',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
        },
        conversation: {
          messages: [
            {
              id: 'user:turn-2',
              kind: 'message',
              itemType: 'userMessage',
              role: 'user',
              text: 'Investigate this regression',
              state: 'streaming',
              threadId: 'thread-2',
              turnId: 'turn-2',
              raw: {
                type: 'userMessage',
                id: 'user:turn-2',
                text: 'Investigate this regression',
              },
            },
          ],
        },
      },
    });

    const completed = chatRuntimeReducer(hydrated, {
      type: 'stream/timeline-item-updated',
      payload: {
        threadId: 'thread-2',
        turnId: 'turn-2',
        item: {
          id: 'user:turn-2',
          kind: 'message',
          itemType: 'userMessage',
          role: 'user',
          text: 'Investigate this regression',
          state: 'complete',
          threadId: 'thread-2',
          turnId: 'turn-2',
          content: [
            { type: 'text', text: 'Investigate this regression' },
            { type: 'skill', name: 'playwright', path: 'skill://playwright' },
          ],
          raw: {
            type: 'userMessage',
            id: 'canonical-user-2',
            content: [
              { type: 'text', text: 'Investigate this regression' },
              { type: 'skill', name: 'playwright', path: 'skill://playwright' },
            ],
          },
        },
      },
    });

    expect(completed.messages).toHaveLength(1);
    expect(completed.messages[0]).toMatchObject({
      id: 'user:turn-2',
      state: 'complete',
      content: [
        { type: 'text', text: 'Investigate this regression' },
        { type: 'skill', name: 'playwright', path: 'skill://playwright' },
      ],
    });
  });

  it('keeps a later same-turn live user message distinct from the accepted row', () => {
    const hydrated = chatRuntimeReducer(createInitialChatRuntimeState(), {
      type: 'bootstrap/succeeded',
      payload: {
        ...bootstrapPayload,
        session: {
          ...bootstrapPayload.session,
          threadId: 'thread-3',
          latestTurn: {
        id: 'turn-3',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
        },
        conversation: {
          messages: [
            {
              id: 'user:turn-3',
              kind: 'message',
              itemType: 'userMessage',
              role: 'user',
              text: 'Start',
              state: 'complete',
              threadId: 'thread-3',
              turnId: 'turn-3',
            },
          ],
        },
      },
    });

    const next = chatRuntimeReducer(hydrated, {
      type: 'stream/timeline-item-updated',
      payload: {
        threadId: 'thread-3',
        turnId: 'turn-3',
        item: {
          id: 'user:turn-3:u2',
          kind: 'message',
          itemType: 'userMessage',
          role: 'user',
          text: 'Steer',
          state: 'complete',
          threadId: 'thread-3',
          turnId: 'turn-3',
          raw: {
            type: 'userMessage',
            id: 'steer-1',
          },
        },
      },
    });

    expect(next.messages.map(message => ({ id: message.id, text: message.text }))).toEqual([
      { id: 'user:turn-3', text: 'Start' },
      { id: 'user:turn-3:u2', text: 'Steer' },
    ]);
  });
});
