import { describe, expect, it } from 'vitest';

import { bootstrapPayload } from './test/sessionReducerHarness';
import { sessionReducer } from './state/session-reducer';
import { createInitialSessionState } from './state/session-state';

describe('sessionReducer turn lifecycle', () => {
  it('moves the accepted interrupt request into interrupting without unlocking input', () => {
    const hydrated = sessionReducer(createInitialSessionState(), {
      type: 'bootstrap/succeeded',
      payload: {
        ...bootstrapPayload,
        session: {
          ...bootstrapPayload.session,
          turnExecution: {
            activeTurnId: 'turn-1',
            turnLifecycle: 'running',
          },
        },
      },
    });

    const next = sessionReducer(hydrated, {
      type: 'interrupt/succeeded',
      payload: {
        ok: true,
        threadId: 'thread-1',
        turnExecution: {
          activeTurnId: 'turn-1',
          turnLifecycle: 'interrupting',
        },
      },
    });

    expect(next.turnExecution.turnLifecycle).toBe('interrupting');
  });

  it('returns to interrupted lifecycle when the interrupted turn completes', () => {
    const interrupting = sessionReducer(createInitialSessionState(), {
      type: 'bootstrap/succeeded',
      payload: {
        ...bootstrapPayload,
        session: {
          ...bootstrapPayload.session,
          turnExecution: {
            activeTurnId: 'turn-1',
            turnLifecycle: 'interrupting',
          },
        },
      },
    });

    const next = sessionReducer(interrupting, {
      type: 'stream/turn-completed',
      payload: {
        threadId: 'thread-1',
        turnExecution: {
          activeTurnId: 'turn-1',
          turnLifecycle: 'interrupted',
        },
        error: null,
      },
    });

    expect(next.turnExecution.turnLifecycle).toBe('interrupted');
  });

  it('keeps interrupting while assistant deltas arrive after stop has been accepted', () => {
    const interrupting = sessionReducer(createInitialSessionState(), {
      type: 'bootstrap/succeeded',
      payload: {
        ...bootstrapPayload,
        session: {
          ...bootstrapPayload.session,
          turnExecution: {
            activeTurnId: 'turn-1',
            turnLifecycle: 'interrupting',
          },
        },
      },
    });

    const next = sessionReducer(interrupting, {
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

    expect(next.turnExecution.turnLifecycle).toBe('interrupting');
    expect(next.messages[1]?.text).toBe('still stopping more');
  });

  it('keeps interrupting while timeline deltas arrive after stop has been accepted', () => {
    const interrupting = sessionReducer(createInitialSessionState(), {
      type: 'bootstrap/succeeded',
      payload: {
        ...bootstrapPayload,
        session: {
          ...bootstrapPayload.session,
          turnExecution: {
            activeTurnId: 'turn-1',
            turnLifecycle: 'interrupting',
          },
        },
      },
    });

    const next = sessionReducer(interrupting, {
      type: 'stream/timeline-item-delta',
      payload: {
        threadId: 'thread-1',
        turnId: 'turn-1',
        itemId: 'plan-1',
        itemType: 'plan',
        delta: 'Inspect reducer state',
      },
    });

    expect(next.turnExecution.turnLifecycle).toBe('interrupting');
    expect(next.messages.at(-1)).toMatchObject({
      id: 'plan-1',
      text: 'Inspect reducer state',
      state: 'streaming',
    });
  });

  it('consumes stream turn_started into canonical running execution', () => {
    const idle = sessionReducer(createInitialSessionState(), {
      type: 'bootstrap/succeeded',
      payload: {
        ...bootstrapPayload,
        session: {
          ...bootstrapPayload.session,
          turnExecution: {
            activeTurnId: null,
            turnLifecycle: 'idle',
          },
        },
      },
    });

    const next = sessionReducer(idle, {
      type: 'stream/turn-started',
      payload: {
        threadId: 'thread-1',
        turnExecution: {
          activeTurnId: 'turn-2',
          turnLifecycle: 'running',
        },
      },
    });

    expect(next.turnExecution).toEqual({
      activeTurnId: 'turn-2',
      turnLifecycle: 'running',
    });
  });
});
