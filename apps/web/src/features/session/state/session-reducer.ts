import type { SessionAction, SessionState } from './session-state';

function createBootstrapState({
  viewerId,
  slotId,
  workspace,
  threadId,
}: {
  viewerId: string;
  slotId: string;
  workspace: string;
  threadId: string;
}): SessionState {
  return {
    phase: 'loading',
    viewerId,
    slotId,
    workspace,
    threadId,
    serverInstanceId: '',
    statusMessage: 'Loading session…',
    errorMessage: '',
  };
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'bootstrap/started':
      return createBootstrapState(action);
    case 'bootstrap/succeeded':
      return {
        phase: 'ready',
        viewerId: action.viewerId,
        slotId: action.slotId,
        workspace: action.workspace,
        threadId: action.threadId,
        serverInstanceId: action.serverInstanceId,
        statusMessage: 'Session synced',
        errorMessage: '',
      };
    case 'bootstrap/auth-required':
      return {
        ...state,
        phase: 'auth-required',
        viewerId: action.viewerId,
        slotId: action.slotId,
        serverInstanceId: '',
        statusMessage: 'Access token required',
        errorMessage: '',
      };
    case 'bootstrap/failed':
      return {
        ...state,
        phase: 'error',
        viewerId: action.viewerId,
        slotId: action.slotId,
        serverInstanceId: '',
        statusMessage: 'Load failed',
        errorMessage: action.errorMessage,
      };
    case 'slot/displaced':
      return {
        ...state,
        phase: 'error',
        viewerId: action.viewerId,
        slotId: action.slotId,
        serverInstanceId: '',
        statusMessage: 'Slot taken over',
        errorMessage: action.errorMessage,
      };
    case 'selection/updated':
      return {
        ...state,
        workspace: action.workspace,
        threadId: action.threadId,
      };
    case 'server/instance-synced':
      return {
        ...state,
        serverInstanceId: action.serverInstanceId,
      };
    default:
      return state;
  }
}
