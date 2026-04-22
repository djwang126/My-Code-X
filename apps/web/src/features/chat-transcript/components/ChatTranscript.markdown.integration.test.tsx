import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import userEvent from '@testing-library/user-event';

import { renderChatTranscriptPage as renderChatPage } from '../test/renderChatTranscriptPage';

describe('ChatTranscript markdown integration', () => {
  it('renders plain transcript messages as markdown', () => {
    renderChatPage({
      messages: [
        {
          id: 'assistant-markdown',
          kind: 'message',
          itemType: 'agentMessage',
          role: 'assistant',
          text:
            '# Plan\n\nUse **bold** text, `inline code`, ~~old~~, and a [docs link](https://example.com).\n\n| Name | Status |\n| --- | --- |\n| API | Done |\n| UI | WIP |\n\n- first\n- second\n\n> note\n\n```ts\nconst answer = 42;\nconsole.log(answer);\n```',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
          raw: {
            type: 'assistantMessage',
            id: 'assistant-markdown',
          },
        },
      ],
    });

    expect(screen.getByRole('heading', { name: 'Plan' })).toBeInTheDocument();
    expect(screen.getByText('bold', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText('inline code', { selector: 'code' })).toBeInTheDocument();
    expect(screen.getByText('old', { selector: 'del' })).toBeInTheDocument();
    const docsLinkButton = screen.getByRole('button', { name: '[docs link]' });
    expect(docsLinkButton).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();
    expect(within(table).getByRole('cell', { name: 'API' })).toBeInTheDocument();
    expect(within(table).getByRole('cell', { name: 'Done' })).toBeInTheDocument();
    expect(screen.getByText('first', { selector: 'li' })).toBeInTheDocument();
    expect(screen.getByText('second', { selector: 'li' })).toBeInTheDocument();
    expect(screen.getByText('note')).toBeInTheDocument();
    expect(screen.getByText(/const answer = 42;/)).toBeInTheDocument();
    expect(screen.getByText(/console\.log\(answer\);/)).toBeInTheDocument();
  });

  it('renders lazily loaded large-item details as literal text instead of markdown', async () => {
    const user = userEvent.setup();
    renderChatPage({
      onTimelineItemContentLoad: async () => ({
        itemId: 'cmd-literal',
        itemType: 'commandExecution',
        detailRevision: 'rev-cmd-literal',
        raw: {
          type: 'commandExecution',
          id: 'cmd-literal',
          command: '# shell heading',
          aggregatedOutput: '# literal heading\n- literal list\n[not a link](https://example.com)',
        },
      }),
      messages: [
        {
          id: 'cmd-literal',
          kind: 'special',
          itemType: 'commandExecution',
          text: '',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
          raw: {
            type: 'commandExecution',
            id: 'cmd-literal',
            detailRevision: 'rev-cmd-literal',
            detailAvailable: true,
          },
        },
      ],
    });

    await user.click(screen.getByText('Command execution').closest('summary')!);

    await waitFor(() => expect(screen.getByText('# shell heading')).toBeInTheDocument());
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === 'DIV' &&
          element.textContent === '# literal heading\n- literal list\n[not a link](https://example.com)',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'shell heading' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'literal heading' })).toBeNull();
    expect(screen.queryByRole('button', { name: '[not a link]' })).toBeNull();
  });

  it('renders reasoning card summaries as markdown after expansion', async () => {
    const user = userEvent.setup();
    renderChatPage({
      messages: [
        {
          id: 'reason-markdown',
          kind: 'special',
          itemType: 'reasoning',
          text: '**Inspect** [logs](https://example.com/logs)',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
          raw: {
            type: 'reasoning',
            id: 'reason-markdown',
            content: [{ text: 'raw reasoning block' }],
          },
        },
      ],
    });

    expect(screen.getByText('Reasoning')?.closest('details')).not.toHaveAttribute('open');

    await user.click(screen.getByText('Reasoning').closest('summary')!);

    expect(screen.getByText('Inspect', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '[logs]' })).toBeInTheDocument();
  });

  it('renders empty reasoning rows as collapsed reasoning cards with placeholder text after expansion', async () => {
    const user = userEvent.setup();
    renderChatPage({
      messages: [
        {
          id: 'reason-empty',
          kind: 'special',
          itemType: 'reasoning',
          text: '',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
          raw: {
            type: 'reasoning',
            id: 'reason-empty',
            summary: [],
            content: [],
          },
        },
      ],
    });

    expect(screen.getByText('Reasoning')).toBeInTheDocument();
    expect(screen.queryByText('No available Reasoning text.')).toBeNull();
    expect(screen.queryByText('Raw')).toBeNull();
    expect(screen.getByText('Reasoning')?.closest('details')).not.toHaveAttribute('open');

    await user.click(screen.getByText('Reasoning').closest('summary')!);

    expect(screen.getByText('No available Reasoning text.')).toBeInTheDocument();
  });

});
