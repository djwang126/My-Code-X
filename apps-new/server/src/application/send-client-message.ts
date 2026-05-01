import type { ClientActionResult, ClientSendMessageAction } from '@my-code-x/contracts-new';
import type { ConversationService } from '../features/conversation/index.js';
import type { TurnService } from '../features/turn/index.js';
import type { RuntimePort } from '../ports/index.js';
import { SkeletonMigrationPendingError } from '../shared/index.js';

export type SendClientMessageInput = ClientSendMessageAction;

export interface SendClientMessageDependencies {
  readonly conversation: ConversationService;
  readonly runtime: RuntimePort;
  readonly turn: TurnService;
}

export interface SendClientMessageUseCaseInput {
  readonly input: SendClientMessageInput;
  readonly dependencies: SendClientMessageDependencies;
}

export async function sendClientMessage(useCase: SendClientMessageUseCaseInput): Promise<ClientActionResult> {
  void useCase;
  throw new SkeletonMigrationPendingError('sendClientMessage');
}
