import type { ChatPageOperationState } from './chat-page-state-types';

export type ChatPageOperationKey = keyof ChatPageOperationState;

export type ChatPageOperationAction =
  | { type: 'operation/started'; operation: ChatPageOperationKey }
  | { type: 'operation/finished'; operation: ChatPageOperationKey };

export function createInitialChatPageOperationState(): ChatPageOperationState {
  return {
    bootstrap: 'idle',
    send: 'idle',
    interrupt: 'idle',
    restart: 'idle',
    threadHistoryLoad: 'idle',
    workspaceSwitch: 'idle',
    pendingRequestSubmit: 'idle',
    workspaceFileOpen: 'idle',
    workspaceFileSave: 'idle',
    rollback: 'idle',
    compact: 'idle',
    reviewStart: 'idle',
  };
}

export function chatPageOperationReducer(
  state: ChatPageOperationState,
  action: ChatPageOperationAction,
): ChatPageOperationState {
  if (action.type === 'operation/started') {
    return {
      ...state,
      [action.operation]: 'pending',
    };
  }

  return {
    ...state,
    [action.operation]: 'idle',
  };
}
