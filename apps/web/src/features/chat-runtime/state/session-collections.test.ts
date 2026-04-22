import { describe, expect, it } from 'vitest';

import type { SessionTimelineItem } from '../session-types';
import { normalizeTimelineItems, reconcileTimelineItem } from './session-collections';

function createMessageItem({
  id,
  text,
  turnId,
}: {
  id: string;
  text: string;
  turnId: string;
}): SessionTimelineItem {
  return {
    id,
    kind: 'message',
    itemType: 'userMessage',
    role: 'user',
    text,
    state: 'complete',
    threadId: 'thread-ordering',
    turnId,
  };
}

describe('normalizeTimelineItems', () => {
  it('keeps resumed user messages distinct by turn and preserves the latest duplicate item position', () => {
    const normalized = normalizeTimelineItems([
      createMessageItem({
        id: 'dup-user',
        text: 'older question',
        turnId: 'turn-1',
      }),
      {
        id: 'assistant-1',
        kind: 'message',
        itemType: 'agentMessage',
        role: 'assistant',
        text: 'older answer',
        state: 'complete',
        threadId: 'thread-ordering',
        turnId: 'turn-1',
      },
      createMessageItem({
        id: 'dup-user',
        text: 'latest question',
        turnId: 'turn-2',
      }),
      {
        id: 'assistant-2',
        kind: 'message',
        itemType: 'agentMessage',
        role: 'assistant',
        text: 'latest answer',
        state: 'complete',
        threadId: 'thread-ordering',
        turnId: 'turn-2',
      },
    ]);

    expect(normalized).toEqual([
      createMessageItem({
        id: 'user:turn-1',
        text: 'older question',
        turnId: 'turn-1',
      }),
      {
        id: 'assistant-1',
        kind: 'message',
        itemType: 'agentMessage',
        role: 'assistant',
        text: 'older answer',
        state: 'complete',
        threadId: 'thread-ordering',
        turnId: 'turn-1',
      },
      createMessageItem({
        id: 'user:turn-2',
        text: 'latest question',
        turnId: 'turn-2',
      }),
      {
        id: 'assistant-2',
        kind: 'message',
        itemType: 'agentMessage',
        role: 'assistant',
        text: 'latest answer',
        state: 'complete',
        threadId: 'thread-ordering',
        turnId: 'turn-2',
      },
    ]);
  });

  it('keeps same-turn user messages stable when the payload is already canonical', () => {
    const normalized = normalizeTimelineItems([
      createMessageItem({
        id: 'user:turn-9',
        text: 'start',
        turnId: 'turn-9',
      }),
      createMessageItem({
        id: 'user:turn-9:u2',
        text: 'steer',
        turnId: 'turn-9',
      }),
      createMessageItem({
        id: 'user:turn-9:u3',
        text: 'clarify',
        turnId: 'turn-9',
      }),
    ]);

    expect(normalized.map(item => item.id)).toEqual(['user:turn-9', 'user:turn-9:u2', 'user:turn-9:u3']);
  });

  it('assigns distinct canonical ids for repeated same-turn raw user message ids', () => {
    const normalized = normalizeTimelineItems([
      createMessageItem({
        id: 'dup-user',
        text: 'start',
        turnId: 'turn-4',
      }),
      createMessageItem({
        id: 'dup-user',
        text: 'steer',
        turnId: 'turn-4',
      }),
      createMessageItem({
        id: 'dup-user',
        text: 'clarify',
        turnId: 'turn-4',
      }),
    ]);

    expect(normalized.map(item => item.id)).toEqual(['user:turn-4', 'user:turn-4:u2', 'user:turn-4:u3']);
  });
});

describe('reconcileTimelineItem', () => {
  it('preserves a later same-turn canonical user id during live updates', () => {
    const reconciled = reconcileTimelineItem(
      [
        createMessageItem({
          id: 'user:turn-live',
          text: 'start',
          turnId: 'turn-live',
        }),
      ],
      createMessageItem({
        id: 'user:turn-live:u2',
        text: 'steer',
        turnId: 'turn-live',
      }),
    );

    expect(reconciled.id).toBe('user:turn-live:u2');
  });
});
