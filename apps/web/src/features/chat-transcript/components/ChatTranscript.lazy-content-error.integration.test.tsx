import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderChatTranscriptPage as renderChatPage } from '../test/renderChatTranscriptPage';

function createTitleOnlyLargeItem(itemId: string, itemType: 'commandExecution' | 'fileChange', detailRevision: string) {
  return {
    id: itemId,
    kind: 'special' as const,
    itemType,
    text: '',
    state: 'complete' as const,
    threadId: 'thread-1',
    turnId: 'turn-1',
    raw: {
      type: itemType,
      id: itemId,
      detailRevision,
      detailAvailable: true,
    },
  };
}

function expectLiteralFieldFragment(text: string) {
  expect(
    screen.getByText(
      (_, element) =>
        Boolean(
          element?.classList.contains('timeline-card-field-value') &&
            (element.textContent?.includes(text) ?? false),
        ),
    ),
  ).toBeInTheDocument();
}

describe('ChatTranscript lazy content error integration', () => {
  it('keeps a failed detail load scoped to the affected card while other transcript content remains readable', async () => {
    const user = userEvent.setup();
    const onTimelineItemContentLoad = vi.fn().mockImplementation(async (itemId: string) => {
      if (itemId === 'cmd-error') {
        throw new Error('Failed loading details.');
      }

      if (itemId === 'file-success') {
        return {
          itemId,
          itemType: 'fileChange' as const,
          detailRevision: 'rev-file',
          raw: {
            type: 'fileChange',
            id: itemId,
            changes: [{ path: 'src/app.tsx', kind: 'update' }],
            output: 'file line 1\nfile line 2',
          },
        };
      }

      throw new Error(`Unexpected content request: ${itemId}`);
    });

    renderChatPage({
      onTimelineItemContentLoad,
      messages: [
        {
          id: 'assistant-context',
          kind: 'message',
          itemType: 'agentMessage',
          role: 'assistant',
          text: 'Still reading transcript',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
        },
        createTitleOnlyLargeItem('cmd-error', 'commandExecution', 'rev-cmd'),
        createTitleOnlyLargeItem('file-success', 'fileChange', 'rev-file'),
      ],
    });

    await user.click(screen.getByText('Command execution').closest('summary')!);
    await user.click(screen.getByText('File change').closest('summary')!);

    await waitFor(() => expect(onTimelineItemContentLoad).toHaveBeenCalledWith('cmd-error'));
    await waitFor(() => expect(onTimelineItemContentLoad).toHaveBeenCalledWith('file-success'));
    await waitFor(() => expect(screen.getByText('Failed loading details.')).toBeInTheDocument());
    await waitFor(() => expectLiteralFieldFragment('file line 2'));

    expect(screen.queryByRole('region', { name: 'Session toasts' })).toBeNull();
    expect(within(screen.getByLabelText('chat transcript section')).queryByRole('alert')).toBeNull();
    expect(screen.getByText('Still reading transcript')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('retries the failed detail load from the affected card without disturbing the rest of the transcript', async () => {
    const user = userEvent.setup();
    const onTimelineItemContentLoad = vi
      .fn()
      .mockRejectedValueOnce(new Error('Failed loading details.'))
      .mockResolvedValueOnce({
        itemId: 'cmd-error',
        itemType: 'commandExecution' as const,
        detailRevision: 'rev-cmd',
        raw: {
          type: 'commandExecution',
          id: 'cmd-error',
          command: 'npm test',
          aggregatedOutput: 'command line 1\ncommand line 2',
        },
      });

    renderChatPage({
      onTimelineItemContentLoad,
      messages: [
        {
          id: 'assistant-context',
          kind: 'message',
          itemType: 'agentMessage',
          role: 'assistant',
          text: 'Still reading transcript',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
        },
        createTitleOnlyLargeItem('cmd-error', 'commandExecution', 'rev-cmd'),
      ],
    });

    await user.click(screen.getByText('Command execution').closest('summary')!);

    await waitFor(() => expect(screen.getByText('Failed loading details.')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Reload details' }));

    await waitFor(() => expect(onTimelineItemContentLoad).toHaveBeenCalledTimes(2));
    await waitFor(() => expectLiteralFieldFragment('command line 2'));
    expect(screen.queryByRole('region', { name: 'Session toasts' })).toBeNull();
    expect(within(screen.getByLabelText('chat transcript section')).queryByRole('alert')).toBeNull();
    expect(screen.queryByText('Failed loading details.')).toBeNull();
    expect(screen.getByText('Still reading transcript')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
