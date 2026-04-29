import type { ClientTurnView } from '../contracts/index.js';
import type { TurnSnapshot } from '../features/turn/index.js';

export interface PresentTurnInput {
  readonly snapshot: TurnSnapshot;
}

export function presentTurn(input: PresentTurnInput): ClientTurnView {
  return {
    current: input.snapshot.current,
  };
}
