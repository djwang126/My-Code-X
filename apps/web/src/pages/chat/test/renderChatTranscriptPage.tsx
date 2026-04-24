import { cleanup, render } from '@testing-library/react';
import { afterEach } from 'vitest';

import { ChatPageLayout } from '..';
import type { ChatPageProps } from '../types';

afterEach(() => {
  cleanup();
});

const defaultProps: ChatPageProps = {
  title: 'My code X',
  status: 'Session synced',
  workspace: 'D:/workspaces/sample',
  threadId: 'thread-1',
  latestTurn: null,
  messages: [],
  pageFeedback: null,
};

export function buildChatTranscriptPageProps(overrides: Partial<ChatPageProps> = {}) {
  return { ...defaultProps, ...overrides };
}

export function renderChatTranscriptPage(overrides: Partial<ChatPageProps> = {}) {
  return render(<ChatPageLayout {...buildChatTranscriptPageProps(overrides)} />);
}
