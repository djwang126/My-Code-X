import { describe, expect, it } from 'vitest';

import { chatPageErrorReducer } from './error-state';
import type { ChatPageError } from './page-state-types';

describe('chatPageErrorReducer', () => {
  it('records a typed error while keeping the shared outlet payload simple', () => {
    const nextState = chatPageErrorReducer(null, {
      type: 'error/recorded',
      error: {
        kind: 'send',
        message: 'Send failed',
      },
    });

    expect(nextState).toEqual<ChatPageError>({
      kind: 'send',
      message: 'Send failed',
    });
  });

  it('replaces the previous error when a newer typed error is recorded', () => {
    const nextState = chatPageErrorReducer(
      {
        kind: 'send',
        message: 'Send failed',
      },
      {
        type: 'error/recorded',
        error: {
          kind: 'restart',
          message: 'Restart failed',
        },
      },
    );

    expect(nextState).toEqual({
      kind: 'restart',
      message: 'Restart failed',
    });
  });

  it('clears the current shared-outlet error payload without losing the typed reducer contract', () => {
    const nextState = chatPageErrorReducer(
      {
        kind: 'pending-request',
        message: 'Request failed',
      },
      { type: 'error/cleared' },
    );

    expect(nextState).toBeNull();
  });

  it('accepts review-start as a first-class typed error kind in the shared outlet state', () => {
    const nextState = chatPageErrorReducer(null, {
      type: 'error/recorded',
      error: {
        kind: 'review-start',
        message: 'Review failed to start',
      },
    });

    expect(nextState).toEqual<ChatPageError>({
      kind: 'review-start',
      message: 'Review failed to start',
    });
  });
});
