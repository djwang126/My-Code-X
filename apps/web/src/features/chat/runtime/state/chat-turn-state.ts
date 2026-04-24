import {
  canInterruptChatTurn,
  canStartChatTurn,
  isChatTurnActive,
  isChatTurnTerminal,
  serializeChatTurn,
} from '@my-code-x/contracts';

import type { ChatTurn } from '../session-types';
import type { RuntimeOperationState } from './chat-runtime-state';

export function canInterruptForChatTurn(latestTurn: ChatTurn | null) {
  return canInterruptChatTurn(latestTurn);
}

export function canInterruptForRuntimeOperation({
  latestTurn,
  operations,
}: {
  latestTurn: ChatTurn | null;
  operations: RuntimeOperationState;
}) {
  return canInterruptChatTurn(latestTurn) && operations.interrupt === 'idle';
}

export function canSendForChatTurn(latestTurn: ChatTurn | null) {
  return canStartChatTurn(latestTurn);
}

export function canSendForRuntimeOperation({
  latestTurn,
  operations,
}: {
  latestTurn: ChatTurn | null;
  operations: RuntimeOperationState;
}) {
  return canStartChatTurn(latestTurn) && operations.send === 'idle' && operations.interrupt === 'idle';
}

export function isRuntimeInterruptPending(operations: RuntimeOperationState) {
  return operations.interrupt === 'pending';
}

export function isChatTurnStateActive(latestTurn: ChatTurn | null) {
  return isChatTurnActive(latestTurn);
}

export function isChatTurnStateTerminal(latestTurn: ChatTurn | null) {
  return isChatTurnTerminal(latestTurn);
}

export function applyChatTurn(turn: ChatTurn | null, fieldName = 'chat turn') {
  return serializeChatTurn(turn, { fieldName });
}
