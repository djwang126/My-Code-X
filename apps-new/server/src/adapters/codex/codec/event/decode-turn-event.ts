import { readString } from '../reader/index.js';
import type { RuntimeEvent } from '../../../../ports/index.js';
import {
  isRichCodexCompletedTurnPayload,
  isRichCodexTurnPayload,
  readCodexJsonArray,
  readCodexTerminalTurnStatus,
  readCodexTurn,
  readOptionalString,
} from '../reader/index.js';
import { cleanRuntimeEvent } from './clean-runtime-event.js';
import type { DecodeCodexNotificationInput } from './codex-notification-input.js';

export function decodeTurnEvent(input: DecodeCodexNotificationInput): RuntimeEvent | null {
  const params = input.params;

  switch (input.method) {
    case 'turn/started': {
      const threadId = readString(params.threadId, 'Codex turn/started threadId');
      const turn = params.turn === undefined || params.turn === null ? null : readCodexTurn(params.turn, 'Codex turn/started turn');
      const turnId = turn?.id ?? readString(params.turnId, 'Codex turn/started turnId');

      return cleanRuntimeEvent({
        kind: 'runtime-turn-started',
        threadId,
        turn: turn && isRichCodexTurnPayload(turn.raw ?? null) ? turn : undefined,
        turnId,
      });
    }

    case 'turn/completed': {
      const turn = readCodexTurn(params.turn, 'Codex turn/completed turn');

      return cleanRuntimeEvent({
        kind: 'runtime-turn-completed',
        threadId: readString(params.threadId, 'Codex turn/completed threadId'),
        turn: isRichCodexCompletedTurnPayload(turn.raw ?? null) ? turn : undefined,
        turnId: turn.id,
        status: readCodexTerminalTurnStatus(turn.status),
        error: turn.error,
      });
    }

    case 'turn/diff/updated':
      return {
        kind: 'runtime-turn-diff-updated',
        threadId: readString(params.threadId, 'Codex turn/diff/updated threadId'),
        turnId: readString(params.turnId, 'Codex turn/diff/updated turnId'),
        diff: readString(params.diff, 'Codex turn/diff/updated diff'),
      };

    case 'turn/plan/updated':
      return {
        kind: 'runtime-turn-plan-updated',
        threadId: readString(params.threadId, 'Codex turn/plan/updated threadId'),
        turnId: readString(params.turnId, 'Codex turn/plan/updated turnId'),
        explanation: readOptionalString(params.explanation, 'Codex turn/plan/updated explanation'),
        plan: readCodexJsonArray(params.plan, 'Codex turn/plan/updated plan'),
      };

    default:
      return null;
  }
}
