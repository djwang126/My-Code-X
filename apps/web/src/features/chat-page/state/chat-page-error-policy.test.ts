import { describe, expect, it } from 'vitest';

import { getChatPageErrorScope } from './chat-page-error-policy';

describe('chat page error policy', () => {
  it('classifies bootstrap errors as blocking', () => {
    expect(getChatPageErrorScope('bootstrap')).toBe('blocking');
  });

  it('classifies page action failures as page-scoped', () => {
    expect(getChatPageErrorScope('send')).toBe('page');
    expect(getChatPageErrorScope('pending-request')).toBe('page');
    expect(getChatPageErrorScope('message-fork')).toBe('page');
  });

  it('classifies module failures as module-scoped', () => {
    expect(getChatPageErrorScope('thread-history')).toBe('module');
    expect(getChatPageErrorScope('workspace-file-open')).toBe('module');
    expect(getChatPageErrorScope('workspace-file-save')).toBe('module');
  });
});
