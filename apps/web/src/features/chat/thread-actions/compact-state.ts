import { isChatTurnStateActive } from '../runtime/state/chat-turn-state';
import type { ChatRuntimeState } from '../runtime';
import {
  createIdleThreadActionState,
  type CompactThreadActionState,
  type ThreadActionState,
} from './thread-action-state';

interface ObserveCompactThreadActionInput {
  action: CompactThreadActionState;
  errorDetail: ChatRuntimeState['errorDetail'];
  latestTurn: ChatRuntimeState['latestTurn'];
  messages: ChatRuntimeState['messages'];
  notices: ChatRuntimeState['notices'];
  threadId: string;
}

function hasObservedCompactionSignal({
  messages,
  notices,
  threadId,
}: Pick<ObserveCompactThreadActionInput, 'messages' | 'notices' | 'threadId'>) {
  const hasCompactionItem = messages.some(
    message => message.threadId === threadId && message.kind === 'special' && message.itemType === 'contextCompaction',
  );

  if (hasCompactionItem) {
    return true;
  }

  return notices.some(notice => notice.id.startsWith('thread/compacted:'));
}

export function observeCompactThreadAction(
  input: ObserveCompactThreadActionInput,
): ThreadActionState {
  if (input.errorDetail?.threadId === input.action.threadId) {
    return createIdleThreadActionState();
  }

  if (input.threadId !== input.action.threadId) {
    return createIdleThreadActionState();
  }

  const observedTurnId =
    isChatTurnStateActive(input.latestTurn) && input.latestTurn?.id
      ? input.latestTurn.id
      : input.action.observedTurnId;
  const observedCompactionSignal =
    input.action.observedCompactionSignal ||
    hasObservedCompactionSignal({
      messages: input.messages,
      notices: input.notices,
      threadId: input.action.threadId,
    });

  if (
    observedTurnId &&
    input.latestTurn?.id === observedTurnId &&
    !isChatTurnStateActive(input.latestTurn)
  ) {
    return createIdleThreadActionState();
  }

  if (observedCompactionSignal && !isChatTurnStateActive(input.latestTurn)) {
    return createIdleThreadActionState();
  }

  if (
    observedTurnId === input.action.observedTurnId &&
    observedCompactionSignal === input.action.observedCompactionSignal
  ) {
    return input.action;
  }

  return {
    ...input.action,
    observedTurnId,
    observedCompactionSignal,
  };
}
