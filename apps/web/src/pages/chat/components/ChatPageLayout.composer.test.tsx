import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ChatPageLayout } from '..';
import { renderChatPage } from './ChatPageLayout.test-helpers';
import type { ChatPageProps } from '../types';

const baseProps: ChatPageProps = {
  title: 'My code X',
  status: 'Session synced',
  workspace: 'D:/workspaces/sample',
  threadId: 'thread-1',
  latestTurn: null,
  messages: [],
  pageFeedback: null,
};

function createPlanNotice({
  explanation = '',
  plan = [
    { step: 'Add failing backend mode tests', status: 'pending' },
    { step: 'Implement gateway/session mode plumbing', status: 'pending' },
    { step: 'Add failing frontend mode tests', status: 'pending' },
    { step: 'Implement mode UI and prompt flow', status: 'pending' },
    { step: 'Run targeted tests and refine', status: 'pending' },
  ],
}: {
  explanation?: string;
  plan?: Array<{ step: string; status: string }>;
} = {}) {
  return {
    id: 'turn/plan/updated:turn-1',
    level: 'info' as const,
    title: 'Todo list updated',
    text: '',
    raw: {
      threadId: 'thread-1',
      turnId: 'turn-1',
      explanation,
      plan,
    },
  };
}

function renderPlanShell(overrides: Partial<ChatPageProps> = {}) {
  return render(
    <ChatPageLayout
      {...baseProps}
      messages={[
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
      ]}
      {...overrides}
    />,
  );
}

describe('ChatPageLayout composer', () => {
  it('renders the hydrated transcript and an enabled composer when input is allowed', () => {
    renderChatPage({
      messages: [
        {
          id: 'user:1',
          kind: 'message',
          itemType: 'userMessage',
          role: 'user',
          text: 'hello',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
        },
        {
          id: 'assistant:1',
          kind: 'message',
          itemType: 'agentMessage',
          role: 'assistant',
          text: 'hi there',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
        },
      ],
    });

    expect(screen.getByRole('log', { name: 'chat transcript' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'chat input' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();
  });

  it('requires an active workspace before allowing chat input', () => {
    renderChatPage({
      status: 'Select a workspace to begin',
      workspace: '',
      threadId: '',
    });

    expect(screen.getByText('Select a workspace to start chatting')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'chat input' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('disables the composer while a turn is active', () => {
    renderChatPage({
      messages: [
        {
          id: 'assistant:1',
          kind: 'message',
          itemType: 'agentMessage',
          role: 'assistant',
          text: 'still thinking',
          state: 'streaming',
          threadId: 'thread-1',
          turnId: 'turn-1',
        },
      ],
      latestTurn: {
        id: 'turn-1',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
    });

    expect(screen.getByText('still thinking')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'chat input' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Stop' })).toBeEnabled();
  });

  it('disables the composer when the active state is still running', () => {
    renderChatPage({
      latestTurn: {
        id: 'turn-1',
        status: 'inProgress',
        error: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      },
    });

    expect(screen.getByRole('textbox', { name: 'chat input' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Stop' })).toBeEnabled();
  });

  it('clears the draft after a successful submit', async () => {
    const onSubmit = vi.fn(async () => true);
    const user = userEvent.setup();

    renderChatPage({ onSubmit });

    const input = screen.getByRole('textbox', { name: 'chat input' });
    await user.type(input, 'Run tests');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        text: 'Run tests',
        content: [{ type: 'text', text: 'Run tests' }],
      }),
    );
    await waitFor(() => expect(input).toHaveValue(''));
  });

  it('keeps the draft after a failed submit', async () => {
    const onSubmit = vi.fn(async () => false);
    const user = userEvent.setup();

    renderChatPage({ onSubmit });

    const input = screen.getByRole('textbox', { name: 'chat input' });
    await user.type(input, 'Keep draft');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        text: 'Keep draft',
        content: [{ type: 'text', text: 'Keep draft' }],
      }),
    );
    expect(input).toHaveValue('Keep draft');
  });

  it('renders the latest todo list inside the standalone todo-list panel', () => {
    renderPlanShell({
      notices: [createPlanNotice()],
    });

    const todoListPanel = screen.getByRole('region', { name: 'Todo list' });
    expect(screen.getByText('5 tasks, 0 completed')).toBeInTheDocument();
    expect(screen.getByText('Add failing backend mode tests')).toBeInTheDocument();
    expect(screen.getByText('Run targeted tests and refine')).toBeInTheDocument();
    expect(todoListPanel.querySelector('.composer-todolist-steps')).not.toBeNull();
  });

  it('collapses and re-expands the todo list panel', async () => {
    const user = userEvent.setup();

    renderPlanShell({
      notices: [createPlanNotice()],
    });

    await user.click(screen.getByRole('button', { name: 'Collapse todo list' }));
    expect(screen.getByRole('region', { name: 'Todo list' })).toHaveClass('is-collapsed');
    expect(screen.queryByText('Add failing backend mode tests')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Expand todo list' }));
    expect(screen.getByRole('region', { name: 'Todo list' })).toHaveClass('is-expanded');
    expect(screen.getByText('Add failing backend mode tests')).toBeInTheDocument();
  });

  it('updates the standalone todo-list panel when the todo-list content changes', () => {
    const view = renderPlanShell({
      notices: [createPlanNotice()],
    });

    view.rerender(
      <ChatPageLayout
        {...baseProps}
        messages={[
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
        ]}
        notices={[
          createPlanNotice({
            plan: [
              { step: 'Add failing backend mode tests', status: 'completed' },
              { step: 'Implement gateway/session mode plumbing', status: 'inProgress' },
              { step: 'Add failing frontend mode tests', status: 'pending' },
            ],
          }),
        ]}
      />,
    );

    expect(screen.getByRole('region', { name: 'Todo list' })).toBeInTheDocument();
    expect(screen.getByText('3 tasks, 1 completed')).toBeInTheDocument();
    expect(screen.getByText('Implement gateway/session mode plumbing')).toBeInTheDocument();
  });

  it('re-expands a collapsed todo list when the todo-list content changes', async () => {
    const user = userEvent.setup();
    const view = renderPlanShell({
      notices: [createPlanNotice()],
    });

    await user.click(screen.getByRole('button', { name: 'Collapse todo list' }));
    expect(screen.getByRole('region', { name: 'Todo list' })).toHaveClass('is-collapsed');

    view.rerender(
      <ChatPageLayout
        {...baseProps}
        messages={[
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
        ]}
        notices={[
          createPlanNotice({
            plan: [
              { step: 'Add failing backend mode tests', status: 'completed' },
              { step: 'Implement gateway/session mode plumbing', status: 'inProgress' },
              { step: 'Add failing frontend mode tests', status: 'pending' },
            ],
          }),
        ]}
      />,
    );

    expect(screen.getByRole('region', { name: 'Todo list' })).toHaveClass('is-expanded');
    expect(screen.getByText('Implement gateway/session mode plumbing')).toBeInTheDocument();
  });

  it('switches the standalone todo-list panel when the thread changes', () => {
    const view = renderPlanShell({
      notices: [createPlanNotice()],
    });

    view.rerender(
      <ChatPageLayout
        {...baseProps}
        threadId="thread-2"
        messages={[
          {
            id: 'plan-message-turn-9',
            kind: 'special',
            itemType: 'plan',
            text: 'Plan placeholder',
            state: 'complete',
            threadId: 'thread-2',
            turnId: 'turn-9',
            raw: {
              type: 'plan',
              id: 'plan-message-turn-9',
              text: 'Plan placeholder',
            },
          },
        ]}
        notices={[
          {
            ...createPlanNotice(),
            id: 'plan-for-thread-2',
            raw: {
              threadId: 'thread-2',
              turnId: 'turn-9',
              explanation: '',
              plan: [{ step: 'Plan for a different thread', status: 'pending' }],
            },
          },
        ]}
      />,
    );

    expect(screen.getByRole('region', { name: 'Todo list' })).toBeInTheDocument();
    expect(screen.getByText('Plan for a different thread')).toBeInTheDocument();
  });

  it('re-expands a collapsed todo list when the thread changes', async () => {
    const user = userEvent.setup();
    const view = renderPlanShell({
      notices: [createPlanNotice()],
    });

    await user.click(screen.getByRole('button', { name: 'Collapse todo list' }));
    expect(screen.getByRole('region', { name: 'Todo list' })).toHaveClass('is-collapsed');

    view.rerender(
      <ChatPageLayout
        {...baseProps}
        threadId="thread-2"
        messages={[
          {
            id: 'plan-message-turn-9',
            kind: 'special',
            itemType: 'plan',
            text: 'Plan placeholder',
            state: 'complete',
            threadId: 'thread-2',
            turnId: 'turn-9',
            raw: {
              type: 'plan',
              id: 'plan-message-turn-9',
              text: 'Plan placeholder',
            },
          },
        ]}
        notices={[
          {
            ...createPlanNotice(),
            id: 'plan-for-thread-2',
            raw: {
              threadId: 'thread-2',
              turnId: 'turn-9',
              explanation: '',
              plan: [{ step: 'Plan for a different thread', status: 'pending' }],
            },
          },
        ]}
      />,
    );

    expect(screen.getByRole('region', { name: 'Todo list' })).toHaveClass('is-expanded');
    expect(screen.getByText('Plan for a different thread')).toBeInTheDocument();
  });

  it('re-expands a collapsed todo list when the workspace changes', async () => {
    const user = userEvent.setup();
    const view = renderPlanShell({
      notices: [createPlanNotice()],
    });

    await user.click(screen.getByRole('button', { name: 'Collapse todo list' }));
    expect(screen.getByRole('region', { name: 'Todo list' })).toHaveClass('is-collapsed');

    view.rerender(
      <ChatPageLayout
        {...baseProps}
        workspace="D:/workspaces/other"
        messages={[
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
        ]}
        notices={[createPlanNotice()]}
      />,
    );

    expect(screen.getByRole('region', { name: 'Todo list' })).toHaveClass('is-expanded');
    expect(screen.getByText('Add failing backend mode tests')).toBeInTheDocument();
  });
});
