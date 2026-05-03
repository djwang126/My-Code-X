import { readString } from '../reader/index.js';
import type { RuntimeResult } from '../../../../ports/index.js';
import {
  isRichCodexTurnPayload,
  readCodexJsonObject,
  readCodexTurn,
} from '../reader/index.js';
import { cleanRuntimeResult } from './clean-runtime-result.js';
import type { DecodeCodexResultInput } from './codex-result-input.js';

export function decodeTurnResult(input: DecodeCodexResultInput): RuntimeResult | null {
  switch (input.command.kind) {
    case 'start-turn': {
      const payload = readCodexJsonObject(input.result, 'Codex turn/start result');
      const turn = readCodexTurn(payload.turn, 'Codex turn/start result.turn');

      return cleanRuntimeResult({
        kind: 'turn-started',
        turnId: turn.id,
        turn: isRichCodexTurnPayload(turn.raw ?? null) ? turn : undefined,
      });
    }

    case 'steer-turn': {
      const payload = readCodexJsonObject(input.result, 'Codex turn/steer result');

      return {
        kind: 'turn-steered',
        turnId: readString(payload.turnId, 'Codex turn/steer turnId'),
      };
    }

    case 'start-review': {
      const payload = readCodexJsonObject(input.result, 'Codex review/start result');
      const turn = readCodexTurn(payload.turn, 'Codex review/start result.turn');

      return cleanRuntimeResult({
        kind: 'review-started',
        turnId: turn.id,
        reviewThreadId: readString(payload.reviewThreadId, 'Codex review/start result.reviewThreadId'),
        turn: isRichCodexTurnPayload(turn.raw ?? null) ? turn : undefined,
      });
    }

    case 'interrupt-turn':
      return {
        kind: 'ok',
      };

    default:
      return null;
  }
}
