import { describe, expect, it } from 'vitest';

import type { SessionNotice } from '../../chat-runtime/public-types';
import { selectThreadTodoState } from './todo-list-selector';

function createTodoNotice({
  id = 'notice-1',
  threadId = 'thread-1',
  turnId = 'turn-1',
  explanation = '',
  plan = [{ step: 'Add failing backend mode tests', status: 'pending' }],
}: {
  id?: string;
  threadId?: string;
  turnId?: string;
  explanation?: string;
  plan?: Array<{ step: string; status: string }>;
} = {}): SessionNotice {
  return {
    id,
    level: 'info',
    title: 'Todo list updated',
    text: '',
    raw: {
      threadId,
      turnId,
      explanation,
      plan,
    },
  };
}

describe('selectThreadTodoState', () => {
  it('derives the latest active todo list from structured notice payloads without relying on notice id format', () => {
    const state = selectThreadTodoState(
      [
        createTodoNotice({
          id: 'older-plan',
          plan: [{ step: 'Older plan', status: 'completed' }],
        }),
        createTodoNotice({
          id: 'latest-structured-plan',
          turnId: 'turn-2',
          explanation: 'Latest plan explanation',
          plan: [
            { step: 'Implement gateway/session mode plumbing', status: 'inProgress' },
            { step: 'Add failing frontend mode tests', status: 'unknown-status' },
          ],
        }),
        {
          id: 'configWarning:latest',
          level: 'warning',
          title: 'Config warning',
          text: 'Sandbox will be tightened soon',
        },
      ],
      'thread-1',
    );

    expect(state.activeTodo).toEqual({
      key: JSON.stringify({
        threadId: 'thread-1',
        turnId: 'turn-2',
        explanation: 'Latest plan explanation',
        steps: [
          { step: 'Implement gateway/session mode plumbing', status: 'inProgress' },
          { step: 'Add failing frontend mode tests', status: 'pending' },
        ],
      }),
      turnId: 'turn-2',
      explanation: 'Latest plan explanation',
      total: 2,
      completed: 0,
      steps: [
        { step: 'Implement gateway/session mode plumbing', status: 'inProgress' },
        { step: 'Add failing frontend mode tests', status: 'pending' },
      ],
    });
    expect(Array.from(state.hiddenNoticeIds)).toEqual(['older-plan', 'latest-structured-plan']);
    expect(state.visibleNotices).toEqual([
      {
        id: 'configWarning:latest',
        level: 'warning',
        title: 'Config warning',
        text: 'Sandbox will be tightened soon',
      },
    ]);
  });

  it('ignores malformed or foreign-thread todo list notices', () => {
    const state = selectThreadTodoState(
      [
        createTodoNotice({
          id: 'foreign-thread-plan',
          threadId: 'thread-2',
        }),
        createTodoNotice({
          id: 'empty-plan',
          plan: [{ step: '   ', status: 'completed' }],
        }),
        {
          id: 'generic-info',
          level: 'info',
          title: 'Info',
          text: 'Still visible',
          raw: {
            plan: [{ step: 'No thread id means not a promoted plan', status: 'pending' }],
          },
        },
      ],
      'thread-1',
    );

    expect(state.activeTodo).toBeNull();
    expect(Array.from(state.hiddenNoticeIds)).toEqual([]);
    expect(state.visibleNotices).toHaveLength(3);
  });
});
