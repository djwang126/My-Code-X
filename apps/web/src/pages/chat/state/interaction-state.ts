import type {
  ChatInteractionState,
  ChatPageStateSnapshot,
} from './page-state-types';
import { isChatTurnStateActive } from '../../../features/chat/runtime';

export function deriveChatInteractionState(
  state: Pick<ChatPageStateSnapshot, 'session' | 'operations'>,
): ChatInteractionState {
  const sessionPhase = state.session.phase ?? 'ready';
  const pendingRequests = state.session.pendingRequests ?? [];
  const restartOperation = state.operations.restart ?? 'idle';
  const sendOperation = state.operations.send ?? 'idle';
  const interruptOperation = state.operations.interrupt ?? 'idle';

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

  if (state.session.threadAction && state.session.threadAction.status !== 'idle') {
    return 'thread-action-pending';
  }

  if (interruptOperation === 'pending' && isChatTurnStateActive(state.session.latestTurn)) {
    return 'interrupting';
  }

  if (pendingRequests.length > 0) {
    return 'awaiting-requests';
  }

  if (sendOperation === 'pending' || isChatTurnStateActive(state.session.latestTurn)) {
    return 'running';
  }

  return 'ready-idle';
}
