import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderChatTranscriptPage as renderChatPage } from '../../../../pages/chat/test/renderChatTranscriptPage';

describe('ChatTranscript workspace links integration', () => {
  it('renders workspace file links as collapsible references and opens them from the expanded target', async () => {
    const user = userEvent.setup();
    const onWorkspaceFileLinkOpen = vi.fn(async () => true);
    const isWorkspaceFileLink = vi.fn((href: string) =>
      [
        'file:///D:/workspace/example-app/AGENTS.md',
        '/D:/workspace/example-app/package.json',
        'D:/workspace/example-app/README.md',
        'docs/guide.md',
      ].includes(href),
    );

    renderChatPage({
      workspace: 'D:/workspace/example-app',
      isWorkspaceFileLink,
      onWorkspaceFileLinkOpen,
      messages: [
        {
          id: 'assistant-links',
          kind: 'message',
          itemType: 'agentMessage',
          role: 'assistant',
          text:
            '[AGENTS.md](file:///D:/workspace/example-app/AGENTS.md) ' +
            '[package.json](/D:/workspace/example-app/package.json) ' +
            '[README](D:/workspace/example-app/README.md) ' +
            '[Guide](docs/guide.md) ' +
            '[OpenAI](https://www.openai.com)',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
          raw: {
            type: 'assistantMessage',
            id: 'assistant-links',
          },
        },
      ],
    });

    const fileButton = screen.getByRole('button', { name: '[AGENTS.md]' });
    const slashAbsolutePathButton = screen.getByRole('button', { name: '[package.json]' });
    const absolutePathButton = screen.getByRole('button', { name: '[README]' });
    const relativePathButton = screen.getByRole('button', { name: '[Guide]' });
    const webButton = screen.getByRole('button', { name: '[OpenAI]' });

    await user.click(fileButton);
    await user.click(slashAbsolutePathButton);
    await user.click(absolutePathButton);
    await user.click(relativePathButton);

    expect(onWorkspaceFileLinkOpen).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '(file:///D:/workspace/example-app/AGENTS.md)' }));
    await user.click(screen.getByRole('button', { name: '(/D:/workspace/example-app/package.json)' }));
    await user.click(screen.getByRole('button', { name: '(D:/workspace/example-app/README.md)' }));
    await user.click(screen.getByRole('button', { name: '(docs/guide.md)' }));

    expect(onWorkspaceFileLinkOpen).toHaveBeenCalledWith('file:///D:/workspace/example-app/AGENTS.md');
    expect(onWorkspaceFileLinkOpen).toHaveBeenCalledWith('/D:/workspace/example-app/package.json');
    expect(onWorkspaceFileLinkOpen).toHaveBeenCalledWith('D:/workspace/example-app/README.md');
    expect(onWorkspaceFileLinkOpen).toHaveBeenCalledWith('docs/guide.md');

    await user.click(webButton);

    expect(screen.getByRole('link', { name: '(https://www.openai.com)' })).toHaveAttribute(
      'href',
      'https://www.openai.com',
    );
    expect(onWorkspaceFileLinkOpen).toHaveBeenCalledTimes(4);
    expect(isWorkspaceFileLink).toHaveBeenCalledWith('file:///D:/workspace/example-app/AGENTS.md');
    expect(isWorkspaceFileLink).toHaveBeenCalledWith('/D:/workspace/example-app/package.json');
    expect(isWorkspaceFileLink).toHaveBeenCalledWith('D:/workspace/example-app/README.md');
    expect(isWorkspaceFileLink).toHaveBeenCalledWith('docs/guide.md');
    expect(isWorkspaceFileLink).toHaveBeenCalledWith('https://www.openai.com');
  });

  it('renders workspace file links inside markdown special items as expandable file targets', async () => {
    const user = userEvent.setup();
    const onWorkspaceFileLinkOpen = vi.fn(async () => true);
    const isWorkspaceFileLink = vi.fn((href: string) => href === 'settings.json');

    renderChatPage({
      workspace: 'D:/workspace/example-app',
      isWorkspaceFileLink,
      onWorkspaceFileLinkOpen,
      messages: [
        {
          id: 'reason-links',
          kind: 'special',
          itemType: 'reasoning',
          text: '[settings](settings.json)',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
          raw: {
            type: 'reasoning',
            id: 'reason-links',
            content: [{ text: 'Inspect config file' }],
          },
        },
      ],
    });

    await user.click(screen.getByText('Reasoning').closest('summary')!);
    await user.click(screen.getByRole('button', { name: '[settings]' }));
    expect(onWorkspaceFileLinkOpen).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '(settings.json)' }));

    expect(onWorkspaceFileLinkOpen).toHaveBeenCalledWith('settings.json');
    expect(isWorkspaceFileLink).toHaveBeenCalledWith('settings.json');
  });
});
