import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderChatPage } from './ChatPageLayout.test-helpers';

function getSessionToastRegion() {
  return screen.queryByRole('region', { name: 'Chat toasts' });
}

function getSessionToastText() {
  return getSessionToastRegion()?.textContent ?? '';
}

function getTranscriptNoticeElements() {
  const transcriptSection = screen.getByLabelText('chat transcript section');
  return [
    ...within(transcriptSection).queryAllByRole('status', { name: /notice$/i }),
    ...within(transcriptSection).queryAllByRole('alert', { name: /notice$/i }),
  ];
}

describe('ChatPageLayout session toasts integration', () => {
  it('renders session notices in the session toast region instead of inside the transcript area', () => {
    renderChatPage({
      messages: [
        {
          id: 'assistant-1',
          kind: 'message',
          itemType: 'agentMessage',
          role: 'assistant',
          text: 'Context compacted',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
        },
      ],
      notices: [
        {
          id: 'configWarning:latest',
          level: 'warning',
          title: 'Config warning',
          text: 'Sandbox will be tightened soon',
        },
      ],
    });

    expect(getTranscriptNoticeElements()).toHaveLength(0);

    const toastRegion = screen.getByRole('region', { name: 'Chat toasts' });
    expect(within(toastRegion).getByText('Config warning')).toBeInTheDocument();
    expect(within(toastRegion).getByText('Sandbox will be tightened soon')).toBeInTheDocument();
  });

  it('renders session notices without mixing in workspace switch warnings', () => {
    renderChatPage({
      workspaceSwitchReason: 'Finish the active turn before switching workspaces.',
      notices: [
        {
          id: 'configWarning:latest',
          level: 'warning',
          title: 'Config warning',
          text: 'Sandbox will be tightened soon',
        },
        {
          id: 'thread/compacted:latest',
          level: 'info',
          title: 'thread compacted',
          text: 'thread compacted',
        },
      ],
    });

    expect(screen.getByRole('region', { name: 'Chat toasts' })).toBeInTheDocument();
    const toastText = getSessionToastText();
    expect(toastText).not.toContain('Finish the active turn before switching workspaces.');
    expect(toastText).toContain('Config warning');
    expect(toastText).toContain('thread compacted');
  });

  it('does not render a session toast region when there are no visible notices', () => {
    renderChatPage({
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
      ],
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
    });

    expect(getSessionToastRegion()).toBeNull();
    expect(screen.getByRole('region', { name: 'Todo list' })).toBeInTheDocument();
  });

  it('renders multiple warning notices in the session toast region without adding workspace switch warnings', () => {
    renderChatPage({
      workspaceSwitchReason: 'Finish the active turn before switching workspaces.',
      notices: [
        {
          id: 'configWarning:latest',
          level: 'warning',
          title: 'Config warning',
          text: 'Sandbox will be tightened soon',
        },
        {
          id: 'deprecationNotice:latest',
          level: 'warning',
          title: 'Deprecation notice',
          text: 'This config key will be removed soon',
        },
      ],
    });

    expect(screen.getByRole('region', { name: 'Chat toasts' })).toBeInTheDocument();
    const toastText = getSessionToastText();
    expect(toastText).not.toContain('Finish the active turn before switching workspaces.');
    expect(toastText).toContain('Config warning');
    expect(toastText).toContain('Deprecation notice');
    expect(toastText.indexOf('Config warning')).toBeLessThan(
      toastText.indexOf('Deprecation notice'),
    );
  });

  it('renders compacted notices as session toasts alongside transcript content', () => {
    renderChatPage({
      messages: [
        {
          id: 'compact-1',
          kind: 'special',
          itemType: 'contextCompaction',
          text: 'Context compacted',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
          raw: {
            type: 'contextCompaction',
            id: 'compact-1',
          },
        },
      ],
      notices: [
        {
          id: 'thread/compacted:latest',
          level: 'info',
          title: 'thread compacted',
          text: 'thread compacted',
        },
      ],
    });

    expect(screen.getAllByText('Context compacted').length).toBeGreaterThan(0);
    expect(getTranscriptNoticeElements()).toHaveLength(0);
    expect(screen.getByRole('region', { name: 'Chat toasts' })).toBeInTheDocument();
    expect(getSessionToastText()).toContain('thread compacted');
  });

});
