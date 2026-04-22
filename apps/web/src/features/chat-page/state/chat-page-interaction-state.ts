import type {
  ChatInteractionState,
  ChatPageStateSnapshot,
} from './chat-page-state-types';
import { isTurnExecutionActive } from '../../chat-runtime';

export function deriveChatInteractionState(
  state: Pick<ChatPageStateSnapshot, 'session' | 'operations'>,
): ChatInteractionState {
  const sessionPhase = state.session.phase ?? 'ready';
  const pendingRequests = state.session.pendingRequests ?? [];
  const turnLifecycle = state.session.turnExecution.turnLifecycle;
  const restartOperation = state.operations.restart ?? 'idle';
  const sendOperation = state.operations.send ?? 'idle';

  if (sessionPhase === 'auth-required') {
    return 'auth-required';
  }

  if (sessionPhase === 'error') {
    return 'load-error';
  }

  if (restartOperation === 'pending') {
    return 'restarting';
  }

  if (sessionPhase !== 'ready') {
    return 'bootstrapping';
  }

  if (pendingRequests.length > 0) {
    return 'awaiting-requests';
  }

  if (turnLifecycle === 'interrupting') {
    return 'interrupting';
  }

  if (sendOperation === 'pending' || isTurnExecutionActive(state.session.turnExecution)) {
    return 'running';
  }

  return 'ready-idle';
}
