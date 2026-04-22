import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderChatTranscriptPage as renderChatPage } from '../test/renderChatTranscriptPage';

describe('ChatTranscript large transcript items', () => {
  it('renders command execution rows as title-only entries in the main transcript', () => {
    renderChatPage({
      messages: [
        {
          id: 'cmd-title-only',
          kind: 'special',
          itemType: 'commandExecution',
          text: '',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
          raw: {
            type: 'commandExecution',
            id: 'cmd-title-only',
            detailRevision: 'rev-cmd',
            detailAvailable: true,
          },
        },
      ],
    });

    expect(screen.getByText('Command execution')).toBeInTheDocument();
    expect(screen.queryByText('npm test')).toBeNull();
    expect(screen.queryByText('D:/workspace/example-app')).toBeNull();
    expect(screen.queryByText('PASS 42 tests')).toBeNull();
  });

  it('renders file change rows as title-only entries in the main transcript', () => {
    renderChatPage({
      messages: [
        {
          id: 'file-title-only',
          kind: 'special',
          itemType: 'fileChange',
          text: '',
          state: 'complete',
          threadId: 'thread-1',
          turnId: 'turn-1',
          raw: {
            type: 'fileChange',
            id: 'file-title-only',
            detailRevision: 'rev-file',
            detailAvailable: true,
          },
        },
      ],
    });

    expect(screen.getByText('File change')).toBeInTheDocument();
    expect(screen.queryByText('src/app.tsx')).toBeNull();
    expect(screen.queryByText('@@ -1,1 +1,1 @@')).toBeNull();
  });
});
