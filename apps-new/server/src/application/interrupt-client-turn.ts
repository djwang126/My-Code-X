import type { ClientActionResult, ClientInterruptTurnAction } from '@my-code-x/contracts-new';
import type { TurnService } from '../features/turn/index.js';
import type { RuntimePort } from '../ports/index.js';
import { SkeletonMigrationPendingError } from '../shared/index.js';

export type InterruptClientTurnInput = ClientInterruptTurnAction;

export interface InterruptClientTurnDependencies {
  readonly runtime: RuntimePort;
  readonly turn: TurnService;
}

export interface InterruptClientTurnUseCaseInput {
  readonly input: InterruptClientTurnInput;
  readonly dependencies: InterruptClientTurnDependencies;
}

export async function interruptClientTurn(useCase: InterruptClientTurnUseCaseInput): Promise<ClientActionResult> {
  void useCase;
  throw new SkeletonMigrationPendingError('interruptClientTurn');
}
