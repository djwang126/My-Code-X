import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderChatPage } from './ChatPageLayout.test-helpers';
import { ChatPageLayout } from '..';
import { buildChatPageProps } from './ChatPageLayout.test-helpers';

describe('ChatPageLayout workspace actions', () => {
  function setTextboxValue(name: string, value: string) {
    fireEvent.change(screen.getByRole('textbox', { name }), {
      target: { value },
    });
  }

  function ExplorerShellHarness({
    onClose,
  }: {
    onClose: () => boolean | Promise<boolean>;
  }) {
    const [workspaceExplorerOpen, setWorkspaceExplorerOpen] = useState(true);

    return (
      <ChatPageLayout
        {...buildChatPageProps({
          workspaceExplorerOpen,
          onWorkspaceExplorerClose: async () => {
            const closed = await onClose();
            if (closed) {
              setWorkspaceExplorerOpen(false);
            }
            return closed;
          },
        })}
      />
    );
  }

  it(
    'lets the user add, open, resume, edit, and remove saved workspaces',
    async () => {
    const onWorkspaceSave = vi.fn();
    const onWorkspaceOpen = vi.fn(async () => true);
    const onWorkspaceResume = vi.fn(async () => true);
    const onWorkspaceRemove = vi.fn();
    const onWorkspaceThreadOpen = vi.fn(async () => true);
    const user = userEvent.setup();

    renderChatPage({
      workspace: 'D:/workspaces/My-Code-X',
      threadId: 'thread-17',
      savedWorkspaces: [
        {
          path: 'D:/workspaces/My-Code-X',
          label: 'My-Code-X',
          lastThreadId: 'thread-17',
        },
      ],
      workspaceThreads: [
        {
          id: 'thread-17',
          name: 'Fix sidebar',
          preview: 'Adjust left sidebar',
          workspace: 'D:/workspaces/My-Code-X',
          createdAt: 1_744_000_000,
          updatedAt: 1_744_000_500,
          statusText: 'idle',
        },
      ],
      onWorkspaceSave,
      onWorkspaceOpen,
      onWorkspaceResume,
      onWorkspaceRemove,
      onWorkspaceThreadOpen,
    });

    await user.click(screen.getByRole('button', { name: 'Toggle workspace sidebar' }));

    expect(screen.getByRole('heading', { name: 'Workspace' })).toBeInTheDocument();
    expect(screen.getByText('Fix sidebar')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Manage workspace/i }));

    expect(screen.getAllByText('My-Code-X').length).toBeGreaterThan(0);
    expect(screen.getAllByText('D:/workspaces/My-Code-X').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Resume' }));
    await waitFor(() => expect(onWorkspaceResume).toHaveBeenCalledWith('D:/workspaces/My-Code-X'));

    await user.click(screen.getByRole('button', { name: 'Open' }));
    await waitFor(() => expect(onWorkspaceOpen).toHaveBeenCalledWith('D:/workspaces/My-Code-X'));
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Workspace path' })).toBeNull());
    expect(screen.getByText('Threads')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Manage workspace/i }));
    await user.click(screen.getByRole('button', { name: 'Edit workspace My-Code-X' }));
    setTextboxValue('Workspace label', 'Renamed repo');
    await user.click(screen.getByRole('button', { name: 'Save workspace' }));
    expect(onWorkspaceSave).toHaveBeenLastCalledWith({
      path: 'D:/workspaces/My-Code-X',
      label: 'Renamed repo',
    });

    setTextboxValue('Workspace path', 'D:/workspaces/codex');
    setTextboxValue('Workspace label', 'Codex');
    await user.click(screen.getByRole('button', { name: 'Save workspace' }));
    expect(onWorkspaceSave).toHaveBeenLastCalledWith({
      path: 'D:/workspaces/codex',
      label: 'Codex',
    });

    await user.click(screen.getByRole('button', { name: 'Remove workspace My-Code-X' }));
    expect(onWorkspaceRemove).toHaveBeenCalledWith('D:/workspaces/My-Code-X');

    await user.click(screen.getByRole('button', { name: /Fix sidebar/i }));
    await waitFor(() => expect(onWorkspaceThreadOpen).toHaveBeenCalledWith('thread-17'));
    },
    10_000,
  );

  it('renders conversation action buttons and calls their handlers', async () => {
    const onNewThread = vi.fn(async () => true);
    const onRestart = vi.fn(async () => true);
    const onRollback = vi.fn(async () => true);
    const onCompact = vi.fn(async () => true);
    const user = userEvent.setup();

    renderChatPage({
      title: 'Web Codex Next',
      onNewThread,
      onRestart,
      onRollback,
      onCompact,
    });

    await user.click(screen.getByRole('button', { name: 'New Thread' }));
    await user.click(screen.getByRole('button', { name: 'Restart' }));
    await user.click(screen.getByRole('button', { name: 'Rollback' }));
    await user.click(screen.getByRole('button', { name: 'Compact' }));

    expect(onNewThread).toHaveBeenCalledTimes(1);
    expect(onRestart).toHaveBeenCalledTimes(1);
    expect(onRollback).toHaveBeenCalledTimes(1);
    expect(onCompact).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Code Review' })).toBeEnabled();
  });

  it('opens the review chooser and submits selected review options', async () => {
    const onReviewStart = vi.fn(async () => true);
    const user = userEvent.setup();

    renderChatPage({
      title: 'Web Codex Next',
      onReviewStart,
    });

    await user.click(screen.getByRole('button', { name: 'Code Review' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Review target' }), 'commit');
    setTextboxValue('Commit sha', 'abc123');
    setTextboxValue('Commit title', 'Fix tests');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Review delivery' }), 'detached');
    await user.click(screen.getByRole('button', { name: 'Start review' }));

    await waitFor(() =>
      expect(onReviewStart).toHaveBeenCalledWith({
        delivery: 'detached',
        target: {
          type: 'commit',
          sha: 'abc123',
          title: 'Fix tests',
        },
      }),
    );
  });

  it('shows token usage in the tools sidebar only when usage data is available', async () => {
    const user = userEvent.setup();

    renderChatPage({
      tokenUsageText: 'last: input 120 · output 45 · total 165 | total: input 500 · output 240 · total 740',
    });

    await user.click(screen.getByRole('button', { name: 'Toggle tools sidebar' }));

    expect(screen.getByText('Token usage')).toBeInTheDocument();
    expect(screen.getByText('last: input 120 · output 45 · total 165')).toBeInTheDocument();
    expect(screen.getByText('total: input 500 · output 240 · total 740')).toBeInTheDocument();
  });

  it('shows a File Explorer button in the tools sidebar and opens the explorer view', async () => {
    const onWorkspaceExplorerOpen = vi.fn(async () => true);
    const user = userEvent.setup();

    renderChatPage({
      onWorkspaceExplorerOpen,
    });

    await user.click(screen.getByRole('button', { name: 'Toggle tools sidebar' }));
    await user.click(screen.getByRole('button', { name: 'File Explorer' }));

    expect(onWorkspaceExplorerOpen).toHaveBeenCalledTimes(1);
  });

  it('closes the explorer before opening the tools sidebar when the close action succeeds', async () => {
    const user = userEvent.setup();
    const onWorkspaceExplorerClose = vi.fn(async () => true);
    const { container } = render(<ExplorerShellHarness onClose={onWorkspaceExplorerClose} />);

    expect(screen.getByRole('region', { name: 'File Explorer' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Toggle tools sidebar' }));

    await waitFor(() => expect(onWorkspaceExplorerClose).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'File Explorer' })).toBeNull());
    expect(container.querySelector('.sidebar-right.open')).not.toBeNull();
  });

  it('keeps the explorer open and does not open the tools sidebar when the close action is rejected', async () => {
    const user = userEvent.setup();
    const onWorkspaceExplorerClose = vi.fn(async () => false);
    const { container } = render(<ExplorerShellHarness onClose={onWorkspaceExplorerClose} />);

    expect(screen.getByRole('region', { name: 'File Explorer' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Toggle tools sidebar' }));

    await waitFor(() => expect(onWorkspaceExplorerClose).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('region', { name: 'File Explorer' })).toBeInTheDocument();
    expect(container.querySelector('.sidebar-right.open')).toBeNull();
  });

  it('hides token usage from the tools sidebar when there is no usage data', async () => {
    const user = userEvent.setup();

    renderChatPage({
      tokenUsageText: '',
    });

    await user.click(screen.getByRole('button', { name: 'Toggle tools sidebar' }));

    expect(screen.queryByText('Token usage')).toBeNull();
  });

  it('disables rollback, compact and review when no active thread exists', () => {
    renderChatPage({
      title: 'Web Codex Next',
      threadId: '',
    });

    expect(screen.getByRole('button', { name: 'New Thread' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Restart' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Rollback' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Compact' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Code Review' })).toBeDisabled();
  });

  it('shows restart progress and disables workspace-changing actions while restarting', async () => {
    const user = userEvent.setup();

    renderChatPage({
      isRestarting: true,
      savedWorkspaces: [
        {
          path: 'D:/workspaces/My-Code-X',
          label: 'My-Code-X',
          lastThreadId: 'thread-17',
        },
      ],
    });

    expect(screen.getByRole('button', { name: 'Restarting…' })).toBeDisabled();
    expect(screen.getByText('Session synced')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Toggle workspace sidebar' }));
    await user.click(screen.getByRole('button', { name: /Manage workspace/i }));

    expect(screen.getByRole('button', { name: 'Open' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Resume' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'New Thread' })).toBeDisabled();
  });

  it('still opens the workspace sidebar when switching is blocked so the user can inspect workspace context', async () => {
    const user = userEvent.setup();
    const { container } = renderChatPage({
      turnExecution: {
        activeTurnId: 'turn-1',
        turnLifecycle: 'running',
      },
      workspaceSwitchReason: 'Finish the active turn before switching workspaces.',
    });

    expect(screen.queryByText('Finish the active turn before switching workspaces.')).not.toBeInTheDocument();
    expect(container.querySelector('.sidebar-left.open')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Toggle workspace sidebar' }));

    expect(screen.queryByText('Finish the active turn before switching workspaces.')).not.toBeInTheDocument();
    expect(container.querySelector('.sidebar-left.open')).not.toBeNull();
  });
});
