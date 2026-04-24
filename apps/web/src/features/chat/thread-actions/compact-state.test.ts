import { describe, expect, it } from 'vitest';
import { parseChatTurn } from '@my-code-x/contracts';

import { observeCompactThreadAction } from './compact-state';
import type { CompactThreadActionState } from './thread-action-state';

function createCompactingAction(overrides: Partial<CompactThreadActionState> = {}): CompactThreadActionState {
  return {
    status: 'compacting-thread',
    threadId: 'thread-1',
    observedTurnId: null,
    observedCompactionSignal: false,
    ...overrides,
  };
}

describe('observeCompactThreadAction', () => {
  it('records the active compact turn id while the turn is running', () => {
    const action = observeCompactThreadAction({
      action: createCompactingAction(),
      errorDetail: null,
      latestTurn: parseChatTurn({
        id: 'turn-compact',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      }),
      messages: [],
      notices: [],
      threadId: 'thread-1',
    });

    expect(action).toEqual({
      status: 'compacting-thread',
      threadId: 'thread-1',
      observedTurnId: 'turn-compact',
      observedCompactionSignal: false,
    });
  });

  it('releases compact state after a compaction signal is observed and no turn is active', () => {
    const action = observeCompactThreadAction({
      action: createCompactingAction(),
      errorDetail: null,
      latestTurn: null,
      messages: [
        {
          id: 'compact-item-1',
          kind: 'special',
          itemType: 'contextCompaction',
          text: 'Context compacted',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-compact',
        },
      ],
      notices: [],
      threadId: 'thread-1',
    });

    expect(action).toEqual({ status: 'idle' });
  });

  it('releases compact state when the observed compact turn becomes terminal', () => {
    const action = observeCompactThreadAction({
      action: createCompactingAction({
        observedTurnId: 'turn-compact',
      }),
      errorDetail: null,
      latestTurn: parseChatTurn({
        id: 'turn-compact',
        status: 'completed',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      }),
      messages: [],
      notices: [],
      threadId: 'thread-1',
    });

    expect(action).toEqual({ status: 'idle' });
  });
});
