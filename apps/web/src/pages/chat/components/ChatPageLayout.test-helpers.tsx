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

export function buildChatPageProps(overrides: Partial<ChatPageProps> = {}) {
  return { ...defaultProps, ...overrides };
}

export function renderChatPage(overrides: Partial<ChatPageProps> = {}) {
  return render(<ChatPageLayout {...buildChatPageProps(overrides)} />);
}
