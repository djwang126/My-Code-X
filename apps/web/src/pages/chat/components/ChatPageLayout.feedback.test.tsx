import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderChatPage } from './ChatPageLayout.test-helpers';

describe('ChatPageLayout feedback integration', () => {
  it('renders page feedback outside the transcript area', () => {
    renderChatPage({
      pageFeedback: {
        scope: 'page',
        error: {
          kind: 'send',
          message: 'Send failed',
        },
      },
      messages: [
        {
          id: 'assistant-1',
          kind: 'message',
          itemType: 'agentMessage',
          role: 'assistant',
          text: 'Prior assistant reply',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
        },
      ],
    });

    const transcriptSection = screen.getByLabelText('chat transcript section');
    const pageFeedback = screen.getByRole('alert', { name: 'Chat page feedback' });

    expect(pageFeedback).toHaveTextContent('Send failed');
    expect(within(transcriptSection).queryByRole('alert')).toBeNull();
  });

  it('keeps workspace explorer errors inside the workspace module', () => {
    renderChatPage({
      workspaceExplorerOpen: true,
      workspaceExplorerError: 'workspace/list failed',
    });

    expect(screen.queryByRole('alert', { name: 'Chat page feedback' })).toBeNull();
    expect(within(screen.getByRole('region', { name: 'File Explorer' })).getByText('workspace/list failed')).toBeInTheDocument();
  });

  it('keeps workspace threads errors inside the workspace sidebar module', () => {
    renderChatPage({
      workspaceThreadsError: 'workspace threads service unavailable',
      workspace: 'D:/workspace/example-app',
    });

    expect(screen.queryByRole('alert', { name: 'Chat page feedback' })).toBeNull();
    expect(within(screen.getByLabelText('workspace threads')).getByText('workspace threads service unavailable')).toBeInTheDocument();
  });
});
