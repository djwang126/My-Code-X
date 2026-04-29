import type { ClientActionResult, ClientRespondInteractionAction } from '../contracts/index.js';
import type { RuntimeRequestService } from '../features/runtime-request/index.js';
import type { RuntimePort } from '../ports/index.js';
import { SkeletonMigrationPendingError } from '../shared/index.js';

export type RespondClientInteractionInput = ClientRespondInteractionAction;

export interface RespondClientInteractionDependencies {
  readonly runtime: RuntimePort;
  readonly runtimeRequests: RuntimeRequestService;
}

export interface RespondClientInteractionUseCaseInput {
  readonly input: RespondClientInteractionInput;
  readonly dependencies: RespondClientInteractionDependencies;
}

export async function respondClientInteraction(useCase: RespondClientInteractionUseCaseInput): Promise<ClientActionResult> {
  void useCase;
  throw new SkeletonMigrationPendingError('respondClientInteraction');
}
