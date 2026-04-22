import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderChatPage } from './ChatPageLayout.test-helpers';

describe('ChatPageLayout todo list integration', () => {
  it('shows todo-list notices in the standalone todo-list panel instead of duplicating them as generic notices', () => {
    renderChatPage({
      messages: [
        {
          id: 'plan-message-turn-1',
          kind: 'special',
          itemType: 'plan',
          text: 'Plan placeholder',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
          raw: {
            type: 'plan',
            id: 'plan-message-turn-1',
            text: 'Plan placeholder',
          },
        },
      ],
      notices: [
        {
          id: 'turn/plan/updated:turn-1',
          level: 'info',
          title: 'Todo list updated',
          text: 'pending: Add failing backend mode tests',
          raw: {
            threadId: 'thread-1',
            turnId: 'turn-1',
            plan: [{ step: 'Add failing backend mode tests', status: 'pending' }],
          },
        },
        {
          id: 'configWarning:latest',
          level: 'warning',
          title: 'Config warning',
          text: 'Sandbox will be tightened soon',
        },
      ],
    });

    expect(screen.getByRole('region', { name: 'Todo list' })).toBeInTheDocument();
    expect(screen.getByText('1 task, 0 completed')).toBeInTheDocument();
    expect(screen.queryByText('Todo list updated')).toBeNull();
    expect(screen.getByText('Config warning')).toBeInTheDocument();
  });

  it('hides older todo-list notices when a newer todo list is shown in the standalone panel', () => {
    renderChatPage({
      messages: [
        {
          id: 'plan-message-turn-2',
          kind: 'special',
          itemType: 'plan',
          text: 'Plan placeholder',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-2',
          raw: {
            type: 'plan',
            id: 'plan-message-turn-2',
            text: 'Plan placeholder',
          },
        },
      ],
      notices: [
        {
          id: 'turn/plan/updated:turn-1',
          level: 'info',
          title: 'Todo list updated',
          text: 'pending: Add failing backend mode tests',
          raw: {
            threadId: 'thread-1',
            turnId: 'turn-1',
            plan: [{ step: 'Add failing backend mode tests', status: 'pending' }],
          },
        },
        {
          id: 'turn/plan/updated:turn-2',
          level: 'info',
          title: 'Todo list updated',
          text: 'completed: Add failing backend mode tests | inProgress: Implement gateway/session mode plumbing',
          raw: {
            threadId: 'thread-1',
            turnId: 'turn-2',
            plan: [
              { step: 'Add failing backend mode tests', status: 'completed' },
              { step: 'Implement gateway/session mode plumbing', status: 'inProgress' },
            ],
          },
        },
        {
          id: 'configWarning:latest',
          level: 'warning',
          title: 'Config warning',
          text: 'Sandbox will be tightened soon',
        },
      ],
    });

    expect(screen.getByRole('region', { name: 'Todo list' })).toBeInTheDocument();
    expect(screen.getByText('2 tasks, 1 completed')).toBeInTheDocument();
    expect(screen.queryByText('pending: Add failing backend mode tests')).toBeNull();
    expect(
      screen.queryByText(
        'completed: Add failing backend mode tests | inProgress: Implement gateway/session mode plumbing',
      ),
    ).toBeNull();
    expect(screen.getByText('Config warning')).toBeInTheDocument();
  });

});
