import { describe, expect, it } from 'vitest';

import {
  chatPageOperationReducer,
  createInitialChatPageOperationState,
} from './chat-page-operation-state';

describe('chatPageOperationReducer', () => {
  it('starts only the targeted operation family and keeps the others idle', () => {
    const nextState = chatPageOperationReducer(createInitialChatPageOperationState(), {
      type: 'operation/started',
      operation: 'send',
    });

    expect(nextState.send).toBe('pending');
    expect(nextState.restart).toBe('idle');
    expect(nextState.pendingRequestSubmit).toBe('idle');
  });

  it('finishes only the targeted operation family without clearing unrelated pending work', () => {
    const sendingState = chatPageOperationReducer(createInitialChatPageOperationState(), {
      type: 'operation/started',
      operation: 'send',
    });
    const mixedState = chatPageOperationReducer(sendingState, {
      type: 'operation/started',
      operation: 'restart',
    });
    const nextState = chatPageOperationReducer(mixedState, {
      type: 'operation/finished',
      operation: 'send',
    });

    expect(nextState.send).toBe('idle');
    expect(nextState.restart).toBe('pending');
  });

  it('treats pending-request submission and review start as distinct operation families', () => {
    const withPendingRequest = chatPageOperationReducer(createInitialChatPageOperationState(), {
      type: 'operation/started',
      operation: 'pendingRequestSubmit',
    });
    const nextState = chatPageOperationReducer(withPendingRequest, {
      type: 'operation/started',
      operation: 'reviewStart',
    });

    expect(nextState.pendingRequestSubmit).toBe('pending');
    expect(nextState.reviewStart).toBe('pending');
    expect(nextState.workspaceFileSave).toBe('idle');
  });
});
