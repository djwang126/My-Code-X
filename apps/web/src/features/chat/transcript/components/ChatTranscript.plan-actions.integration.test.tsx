import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderChatTranscriptPage as renderChatPage } from '../../../../pages/chat/test/renderChatTranscriptPage';

describe('ChatTranscript plan actions integration', () => {
  it('only shows the inline implementation action for the latest eligible proposed-plan card', () => {
    const onConfirmProposedPlanAction = vi.fn(async () => true);
    const onDismissProposedPlanAction = vi.fn(async () => true);

    renderChatPage({
      onConfirmProposedPlanAction,
      onDismissProposedPlanAction,
      runtimeSettings: {
        model: 'gpt-5.1-codex',
        reasoningEffort: 'medium',
        approvalPolicy: 'never',
        sandboxMode: 'danger-full-access',
        collaborationModeKind: 'plan',
      },
      messages: [
        {
          id: 'user-turn-1',
          kind: 'message',
          itemType: 'userMessage',
          role: 'user',
          text: 'Draft a first plan',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
        },
        {
          id: 'plan-turn-1',
          kind: 'special',
          itemType: 'plan',
          text: 'Older plan',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
          raw: { type: 'plan', id: 'plan-turn-1', text: 'Older plan' },
        },
        {
          id: 'user-turn-2',
          kind: 'message',
          itemType: 'userMessage',
          role: 'user',
          text: 'Draft a better plan',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-2',
        },
        {
          id: 'plan-turn-2',
          kind: 'special',
          itemType: 'plan',
          text: 'Latest plan',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-2',
          raw: { type: 'plan', id: 'plan-turn-2', text: 'Latest plan' },
        },
      ],
    });

    const latestPlanAction = screen.getByLabelText('proposed plan action for plan-turn-2');
    const olderPlanCard = screen.getByText('Older plan').closest('.special-item');

    expect(screen.getAllByRole('button', { name: 'Implement plan' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Stay in Plan mode' })).toHaveLength(1);
    expect(latestPlanAction.textContent).toContain('Implement plan');
    expect(latestPlanAction.textContent).toContain('Stay in Plan mode');
    expect(olderPlanCard?.textContent).not.toContain('Implement plan');
  });

  it('keeps a resolved proposed-plan action card after the user chooses to stay in Plan mode', () => {
    window.sessionStorage.setItem(
      'my-code-x-proposed-plan-action:thread-1:plan-turn-1',
      JSON.stringify({ decision: 'stayInPlan' }),
    );

    renderChatPage({
      messages: [
        {
          id: 'plan-turn-1',
          kind: 'special',
          itemType: 'plan',
          text: 'Plan to keep',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
          raw: { type: 'plan', id: 'plan-turn-1', text: 'Plan to keep' },
        },
      ],
    });

    const resolvedAction = screen.getByLabelText('proposed plan action for plan-turn-1');
    expect(resolvedAction.textContent).toContain('Stayed in Plan mode');
    expect(resolvedAction.textContent).toContain('Kept');
    expect(screen.queryByRole('button', { name: 'Implement plan' })).toBeNull();
  });
});
