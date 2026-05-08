import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderChatPage } from './ChatPageLayout.test-helpers';

describe('ChatPageLayout chrome integration', () => {
  it('renders thread chrome metadata and non-transcript notices', () => {
    renderChatPage({
      workspace: 'D:/workspaces/My-Code-X',
      savedWorkspaces: [
        {
          path: 'D:/workspaces/My-Code-X',
          label: 'My-Code-X',
          lastThreadId: '',
        },
      ],
      threadName: 'Issue 9 work',
      threadStatusText: 'archived',
      notices: [
        {
          id: 'configWarning:latest',
          level: 'warning',
          title: 'Config warning',
          text: 'Sandbox will be tightened soon',
        },
      ],
    });

    screen.getByRole('button', { name: 'Toggle workspace sidebar' }).click();
    expect(screen.getByText('Issue 9 work')).toBeInTheDocument();
    expect(screen.getByText('My-Code-X')).toBeInTheDocument();
    expect(screen.getAllByText('D:/workspaces/My-Code-X').length).toBeGreaterThan(0);
    expect(screen.getByText('Config warning')).toBeInTheDocument();
    expect(screen.getByText('Sandbox will be tightened soon')).toBeInTheDocument();
  });

});
