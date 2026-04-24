import {
  canInterruptChatTurn,
  canStartChatTurn,
  isChatTurnActive,
  serializeChatTurn,
  type ChatTurn,
} from '@my-code-x/contracts';

import type { ChatSessionState } from './chat-types.js';

export function applyRuntimeChatTurn(runtime: ChatSessionState, turn: ChatTurn | null) {
  runtime.latestTurn = serializeChatTurn(turn, {
    fieldName: 'runtime latestTurn',
  });
}

export function canRuntimeSend(runtime: ChatSessionState) {
  return canStartChatTurn(runtime.latestTurn);
}

export function canRuntimeInterrupt(runtime: ChatSessionState) {
  return canInterruptChatTurn(runtime.latestTurn);
}

export function isRuntimeTurnActive(runtime: ChatSessionState) {
  return isChatTurnActive(runtime.latestTurn);
}
