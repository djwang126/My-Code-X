import type { ClientTurnView } from '../contracts/index.js';
import type { TurnSnapshot } from '../features/turn/index.js';

export interface PresentTurnInput {
  readonly snapshot: TurnSnapshot;
}

export function presentTurn(input: PresentTurnInput): ClientTurnView {
  const snapshot = input.snapshot;
  switch (snapshot.lifecycle) {
    case 'idle':
      return {
        lifecycle: 'idle',
        active: false,
        canSend: true,
        canInterrupt: false,
        visibleStatus: 'Idle',
      };

    case 'starting':
    case 'streaming':
      return {
        lifecycle: snapshot.lifecycle,
        active: true,
        canSend: false,
        canInterrupt: true,
        visibleStatus: snapshot.lifecycle === 'starting' ? 'Starting' : 'Running',
      };

    case 'waiting-for-input':
      return {
        lifecycle: 'waiting-for-input',
        active: true,
        canSend: false,
        canInterrupt: true,
        visibleStatus: 'Waiting for input',
      };

    case 'completed':
    case 'failed':
    case 'interrupted':
      return {
        lifecycle: snapshot.lifecycle,
        active: false,
        canSend: true,
        canInterrupt: false,
        visibleStatus: snapshot.lifecycle,
      };
  }
}
