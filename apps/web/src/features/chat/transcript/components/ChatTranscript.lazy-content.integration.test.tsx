import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ChatPageLayout } from '../../../../pages/chat';
import {
  buildChatTranscriptPageProps as buildChatPageProps,
  renderChatTranscriptPage as renderChatPage,
} from '../../../../pages/chat/test/renderChatTranscriptPage';

function createCommandDetailPayload(itemId: string, detailRevision: string, output: string) {
  return {
    itemId,
    itemType: 'commandExecution' as const,
    detailRevision,
    raw: {
      type: 'commandExecution',
      id: itemId,
      command: 'npm test',
      cwd: 'D:/workspace/example-app',
      aggregatedOutput: output,
      exitCode: 0,
      durationMs: 123,
    },
  };
}

function createFileDetailPayload(itemId: string, detailRevision: string, output: string) {
  return {
    itemId,
    itemType: 'fileChange' as const,
    detailRevision,
    raw: {
      type: 'fileChange',
      id: itemId,
      changes: [{ path: 'src/app.tsx', kind: 'update' }],
      output,
    },
  };
}

function createTitleOnlyLargeItem(
  itemId: string,
  itemType: 'commandExecution' | 'fileChange',
  detailRevision: string,
  state: 'complete' | 'streaming' = 'complete',
) {
  return {
    id: itemId,
    kind: 'special' as const,
    itemType,
    text: '',
    state,
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

describe('ChatTranscript lazy content integration', () => {
  it('waits for title expansion before loading large item details', async () => {
    const user = userEvent.setup();
    const onTimelineItemContentLoad = vi
      .fn()
      .mockResolvedValueOnce(createCommandDetailPayload('cmd-lazy', 'rev-cmd', 'command line 1\ncommand line 2'))
      .mockResolvedValueOnce(createFileDetailPayload('file-lazy', 'rev-file', 'file line 1\nfile line 2'));

    renderChatPage({
      onTimelineItemContentLoad,
      messages: [
        createTitleOnlyLargeItem('cmd-lazy', 'commandExecution', 'rev-cmd'),
        createTitleOnlyLargeItem('file-lazy', 'fileChange', 'rev-file'),
      ],
    });

    expect(onTimelineItemContentLoad).not.toHaveBeenCalled();
    expect(screen.queryByText('npm test')).toBeNull();
    expect(screen.queryByText('src/app.tsx')).toBeNull();

    await user.click(screen.getByText('Command execution').closest('summary')!);
    await user.click(screen.getByText('File change').closest('summary')!);

    await waitFor(() => expect(onTimelineItemContentLoad).toHaveBeenCalledWith('cmd-lazy'));
    await waitFor(() => expect(onTimelineItemContentLoad).toHaveBeenCalledWith('file-lazy'));
    await waitFor(() => expectLiteralFieldFragment('command line 2'));
    await waitFor(() => expectLiteralFieldFragment('src/app.tsx'));
    await waitFor(() => expectLiteralFieldFragment('file line 2'));
  });

  it('re-syncs expanded command execution details when the hidden detail revision changes', async () => {
    const user = userEvent.setup();
    const onTimelineItemContentLoad = vi
      .fn()
      .mockResolvedValueOnce(createCommandDetailPayload('cmd-streaming', 'rev-1', 'command line 1\ncommand line 2'))
      .mockResolvedValueOnce(createCommandDetailPayload('cmd-streaming', 'rev-2', 'command line 1\ncommand line 3'));

    const { rerender } = renderChatPage({
      onTimelineItemContentLoad,
      messages: [createTitleOnlyLargeItem('cmd-streaming', 'commandExecution', 'rev-1', 'streaming')],
    });

    await user.click(screen.getByText('Command execution').closest('summary')!);

    await waitFor(() => expect(onTimelineItemContentLoad).toHaveBeenCalledWith('cmd-streaming'));
    await waitFor(() => expectLiteralFieldFragment('command line 2'));

    rerender(
      <ChatPageLayout
        {...buildChatPageProps({
          onTimelineItemContentLoad,
          messages: [createTitleOnlyLargeItem('cmd-streaming', 'commandExecution', 'rev-2', 'streaming')],
        })}
      />,
    );

    await waitFor(() => expect(onTimelineItemContentLoad).toHaveBeenCalledTimes(2));
    await waitFor(() => expectLiteralFieldFragment('command line 3'));
  });
});
