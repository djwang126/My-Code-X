import {
  parseChatTurnStatus,
  serializeChatTurn,
  type ChatTurn,
  type SessionErrorPresentationScope,
} from '@my-code-x/contracts';

import { createCodexRuntimeErrorFromTurnError } from './codex-runtime-error.js';
import type { LooseRecord } from './codex-types.js';

interface NormalizeCodexTurnInput {
  turn: LooseRecord;
  threadId?: string | null;
  presentationScope?: SessionErrorPresentationScope;
  source: string;
  fieldName?: string;
}

function normalizeCodexTurnStatus(status: unknown, fieldName: string) {
  return parseChatTurnStatus(status === 'in_progress' ? 'inProgress' : status, {
    fieldName: `${fieldName}.status`,
  });
}

function normalizeNullableNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function normalizeCodexTurn({
  turn,
  threadId = null,
  presentationScope = 'conversation',
  source,
  fieldName = 'codex turn',
}: NormalizeCodexTurnInput): ChatTurn {
  const turnId = typeof turn?.id === 'string' ? turn.id : '';
  const chatTurn: ChatTurn = {
    id: turnId,
    status: normalizeCodexTurnStatus(turn?.status, fieldName),
    error: createCodexRuntimeErrorFromTurnError({
      error: turn?.error,
      threadId,
      turnId,
      presentationScope,
      source,
    }),
    startedAt: normalizeNullableNumber(turn?.startedAt),
    completedAt: normalizeNullableNumber(turn?.completedAt),
    durationMs: normalizeNullableNumber(turn?.durationMs),
  };

  return serializeChatTurn(chatTurn, { fieldName }) as ChatTurn;
}

export function normalizeCodexTurnStarted(input: NormalizeCodexTurnInput): ChatTurn & { status: 'inProgress' } {
  const turn = normalizeCodexTurn(input);

  if (turn.status !== 'inProgress') {
    const fieldName = input.fieldName ?? 'codex turn';
    throw new Error(`${fieldName}.status must be inProgress.`);
  }

  return turn as ChatTurn & { status: 'inProgress' };
}

export function normalizeCodexTurnCompleted(
  input: NormalizeCodexTurnInput,
): ChatTurn & { status: 'completed' | 'interrupted' | 'failed' } {
  const turn = normalizeCodexTurn(input);

  if (turn.status !== 'completed' && turn.status !== 'interrupted' && turn.status !== 'failed') {
    const fieldName = input.fieldName ?? 'codex turn';
    throw new Error(`${fieldName}.status must be completed, interrupted, or failed.`);
  }

  return turn as ChatTurn & { status: 'completed' | 'interrupted' | 'failed' };
}
