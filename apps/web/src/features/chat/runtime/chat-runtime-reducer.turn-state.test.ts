import { describe, expect, it } from 'vitest';

import { bootstrapPayload } from './test/chatRuntimeReducerHarness';
import { chatRuntimeReducer } from './state/chat-runtime-reducer';
import { createInitialChatRuntimeState } from './state/chat-runtime-state';

describe('chatRuntimeReducer chat turn state', () => {
  it('keeps the turn in progress while an accepted interrupt request is pending locally', () => {
    const hydrated = chatRuntimeReducer(createInitialChatRuntimeState(), {
      type: 'bootstrap/succeeded',
      payload: bootstrapPayload,
    });

    const requested = chatRuntimeReducer(hydrated, {
      type: 'interrupt/requested',
    });
    const next = chatRuntimeReducer(requested, {
      type: 'interrupt/succeeded',
      payload: {
        ok: true,
        threadId: 'thread-1',
        turn: requested.latestTurn,
      },
    });

    expect(next.latestTurn?.status).toBe('inProgress');
    expect(next.operations.interrupt).toBe('pending');
  });

  it('returns to idle interrupt operation when the interrupted turn completes', () => {
    const hydrated = chatRuntimeReducer(createInitialChatRuntimeState(), {
      type: 'bootstrap/succeeded',
      payload: bootstrapPayload,
    });
    const interrupting = chatRuntimeReducer(hydrated, { type: 'interrupt/requested' });

    const next = chatRuntimeReducer(interrupting, {
      type: 'stream/turn-completed',
      payload: {
        threadId: 'thread-1',
        turn: {
          id: 'turn-1',
          status: 'interrupted',
          error: null,
          startedAt: null,
          completedAt: null,
          durationMs: null,
        },
        error: null,
      },
    });

    expect(next.latestTurn?.status).toBe('interrupted');
    expect(next.operations.interrupt).toBe('idle');
  });

  it('does not re-enter interrupt pending when the interrupt response arrives after turn completion', () => {
    const hydrated = chatRuntimeReducer(createInitialChatRuntimeState(), {
      type: 'bootstrap/succeeded',
      payload: bootstrapPayload,
    });
    const interrupting = chatRuntimeReducer(hydrated, { type: 'interrupt/requested' });
    const completed = chatRuntimeReducer(interrupting, {
      type: 'stream/turn-completed',
      payload: {
        threadId: 'thread-1',
        turn: {
          id: 'turn-1',
          status: 'interrupted',
          error: null,
          startedAt: null,
          completedAt: null,
          durationMs: null,
        },
        error: null,
      },
    });

    const next = chatRuntimeReducer(completed, {
      type: 'interrupt/succeeded',
      payload: {
        ok: true,
        threadId: 'thread-1',
        turn: completed.latestTurn,
      },
    });

    expect(next.latestTurn?.status).toBe('interrupted');
    expect(next.operations.interrupt).toBe('idle');
  });

  it('keeps interrupt pending while assistant deltas arrive after stop has been accepted', () => {
    const hydrated = chatRuntimeReducer(createInitialChatRuntimeState(), {
      type: 'bootstrap/succeeded',
      payload: bootstrapPayload,
    });
    const interrupting = chatRuntimeReducer(hydrated, { type: 'interrupt/requested' });

    const next = chatRuntimeReducer(interrupting, {
      type: 'stream/assistant-deltas',
      payloads: [
        {
          threadId: 'thread-1',
          turnId: 'turn-1',
          messageId: 'assistant:1',
          delta: ' more',
          text: 'still stopping more',
        },
      ],
      latestPayload: {
        threadId: 'thread-1',
        turnId: 'turn-1',
        messageId: 'assistant:1',
        delta: ' more',
        text: 'still stopping more',
      },
    });

    expect(next.latestTurn?.status).toBe('inProgress');
    expect(next.operations.interrupt).toBe('pending');
    expect(next.messages[1]?.text).toBe('still stopping more');
  });

  it('keeps interrupt pending while timeline deltas arrive after stop has been accepted', () => {
    const hydrated = chatRuntimeReducer(createInitialChatRuntimeState(), {
      type: 'bootstrap/succeeded',
      payload: bootstrapPayload,
    });
    const interrupting = chatRuntimeReducer(hydrated, { type: 'interrupt/requested' });

    const next = chatRuntimeReducer(interrupting, {
      type: 'stream/timeline-item-delta',
      payload: {
        threadId: 'thread-1',
        turnId: 'turn-1',
        itemId: 'plan-1',
        itemType: 'plan',
        delta: 'Inspect reducer state',
      },
    });

    expect(next.latestTurn?.status).toBe('inProgress');
    expect(next.operations.interrupt).toBe('pending');
    expect(next.messages.at(-1)).toMatchObject({
      id: 'plan-1',
      text: 'Inspect reducer state',
      state: 'streaming',
    });
  });

  it('consumes stream turn_started as an in-progress Codex turn and clears local operations', () => {
    const idle = chatRuntimeReducer(createInitialChatRuntimeState(), {
      type: 'bootstrap/succeeded',
      payload: {
        ...bootstrapPayload,
        session: {
          ...bootstrapPayload.session,
          latestTurn: null,
        },
      },
    });
    const sending = chatRuntimeReducer(idle, { type: 'send/requested' });

    const next = chatRuntimeReducer(sending, {
      type: 'stream/turn-started',
      payload: {
        threadId: 'thread-1',
        turn: {
          id: 'turn-2',
          status: 'inProgress',
          error: null,
          startedAt: null,
          completedAt: null,
          durationMs: null,
        },
      },
    });

    expect(next.latestTurn).toEqual({
      id: 'turn-2',
      status: 'inProgress',
      error: null,
      startedAt: null,
      completedAt: null,
      durationMs: null,
    });
    expect(next.operations).toEqual({
      send: 'idle',
      interrupt: 'idle',
    });
  });
});
