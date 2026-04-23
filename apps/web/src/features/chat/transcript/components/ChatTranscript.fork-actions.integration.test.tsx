import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderChatTranscriptPage as renderChatPage } from '../../../../pages/chat/test/renderChatTranscriptPage';

describe('ChatTranscript fork actions integration', () => {
  it('renders a fork button for the last completed assistant message in each completed turn', () => {
    const onMessageFork = vi.fn(async () => true);

    renderChatPage({
      onMessageFork,
      messages: [
        {
          id: 'user-1',
          kind: 'message',
          itemType: 'userMessage',
          role: 'user',
          text: 'first prompt',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
        },
        {
          id: 'assistant-earlier-complete',
          kind: 'message',
          itemType: 'agentMessage',
          role: 'assistant',
          text: 'earlier final answer',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
        },
        {
          id: 'assistant-complete',
          kind: 'message',
          itemType: 'agentMessage',
          role: 'assistant',
          text: 'final answer',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-2',
        },
        {
          id: 'assistant-streaming',
          kind: 'message',
          itemType: 'agentMessage',
          role: 'assistant',
          text: 'thinking',
          state: 'streaming',
          threadId: 'thread-1',
          turnId: 'turn-2',
        },
      ],
    });

    const forkButtons = screen.getAllByRole('button', { name: 'Fork reply' });
    expect(forkButtons).toHaveLength(1);
    expect(forkButtons[0]).toHaveAttribute('data-message-id', 'assistant-earlier-complete');
  });

  it('does not expose a fork action for user rows or for the active streaming assistant turn', () => {
    renderChatPage({
      messages: [
        {
          id: 'user-1',
          kind: 'message',
          itemType: 'userMessage',
          role: 'user',
          text: 'prompt',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
        },
        {
          id: 'assistant-streaming',
          kind: 'message',
          itemType: 'agentMessage',
          role: 'assistant',
          text: 'still working',
          state: 'streaming',
          threadId: 'thread-1',
          turnId: 'turn-1',
        },
      ],
    });

    expect(screen.queryByRole('button', { name: 'Fork reply' })).toBeNull();
  });
});
