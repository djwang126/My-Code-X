import { parseChatTurn as parseContractChatTurn, parseNullableChatTurn } from '@my-code-x/contracts';

import type { ChatTurn, ChatTurnInProgress, ChatTurnTerminal } from '../../session-types';
import { fail } from './readers';

export function parsePayloadChatTurn(value: unknown, fieldName: string): ChatTurn {
  return parseContractChatTurn(value, { fieldName });
}

export function parsePayloadNullableChatTurn(value: unknown, fieldName: string): ChatTurn | null {
  return parseNullableChatTurn(value, { fieldName });
}

export function parsePayloadChatTurnInProgress(value: unknown, fieldName: string): ChatTurnInProgress {
  const turn = parsePayloadChatTurn(value, fieldName);

  if (turn.status !== 'inProgress') {
    fail(`${fieldName}.status`, 'inProgress');
  }

  return turn as ChatTurnInProgress;
}

export function parsePayloadChatTurnTerminal(value: unknown, fieldName: string): ChatTurnTerminal {
  const turn = parsePayloadChatTurn(value, fieldName);

  if (turn.status !== 'completed' && turn.status !== 'interrupted' && turn.status !== 'failed') {
    fail(`${fieldName}.status`, 'completed, interrupted, or failed');
  }

  return turn as ChatTurnTerminal;
}
