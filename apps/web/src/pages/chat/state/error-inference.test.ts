import { describe, expect, it } from 'vitest';

import { inferChatPageError } from './error-inference';

describe('inferChatPageError', () => {
  it('returns null when there is no message', () => {
    expect(
      inferChatPageError({
        interactionState: 'ready-idle',
        message: '   ',
        sessionErrorHint: 'send',
      }),
    ).toBeNull();
  });

  it('maps load-error messages to bootstrap errors', () => {
    expect(
      inferChatPageError({
        interactionState: 'load-error',
        message: 'Failed to bootstrap.',
        sessionErrorHint: 'send',
      }),
    ).toEqual({
      kind: 'bootstrap',
      message: 'Failed to bootstrap.',
    });
  });

  it('uses the latest session error hint for ready-state failures', () => {
    expect(
      inferChatPageError({
        interactionState: 'running',
        message: 'Interrupt failed.',
        sessionErrorHint: 'interrupt',
      }),
    ).toEqual({
      kind: 'interrupt',
      message: 'Interrupt failed.',
    });
  });
});
