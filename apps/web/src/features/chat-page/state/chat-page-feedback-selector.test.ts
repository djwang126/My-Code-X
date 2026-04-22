import { describe, expect, it } from 'vitest';

import { selectChatPageFeedback } from './chat-page-feedback-selector';

describe('selectChatPageFeedback', () => {
  it('returns null when there is no error', () => {
    expect(selectChatPageFeedback(null)).toBeNull();
  });

  it('returns null for workspace-scoped errors', () => {
    expect(
      selectChatPageFeedback({
        kind: 'workspace-file-open',
        message: 'workspace/file/read failed',
      }),
    ).toBeNull();
  });

  it('returns null for bootstrap errors handled by the session gate', () => {
    expect(
      selectChatPageFeedback({
        kind: 'bootstrap',
        message: 'Load failed',
      }),
    ).toBeNull();
  });

  it('returns null for thread history errors handled inside the sidebar module', () => {
    expect(
      selectChatPageFeedback({
        kind: 'thread-history',
        message: 'thread history service unavailable',
      }),
    ).toBeNull();
  });

  it('returns page feedback for shared chat page failures', () => {
    expect(
      selectChatPageFeedback({
        kind: 'send',
        message: 'Send failed',
      }),
    ).toEqual({
      scope: 'page',
      error: {
        kind: 'send',
        message: 'Send failed',
      },
    });
  });

  it('preserves typed page feedback for message fork failures', () => {
    expect(
      selectChatPageFeedback({
        kind: 'message-fork',
        message: 'Fork failed',
      }),
    ).toEqual({
      scope: 'page',
      error: {
        kind: 'message-fork',
        message: 'Fork failed',
      },
    });
  });
});
